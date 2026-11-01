import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@unisaas/database';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { verifyTotp } from './totp.js';
import type {
  PlatformLoginDto,
  PlatformMfaVerifyDto,
  ResetPasswordDto,
} from '../dto/identity-extended.dto.js';

export interface PlatformMfaChallenge {
  mfaRequired: true;
  challengeToken: string;
  email: string;
  adminName: string;
}

@Injectable()
export class PlatformService {
  // Retención en memoria de desafíos MFA temporales (5 min)
  private readonly mfaChallenges = new Map<
    string,
    { email: string; adminName: string; totpSecret: string; expiresAt: number }
  >();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: PlatformLoginDto) {
    const adminEmail = (dto.email || '').trim().toLowerCase();
    const envAdminEmail = (process.env.PLATFORM_ADMIN_EMAIL || 'superadmin@unisaas.com').toLowerCase();
    const envAdminPassword = process.env.PLATFORM_ADMIN_PASSWORD || 'SuperClave2026!';
    const envTotpSecret = process.env.PLATFORM_MFA_SECRET || 'JBSWY3DPEHPK3PXP';

    if (adminEmail !== envAdminEmail || dto.password !== envAdminPassword) {
      throw new UnauthorizedException('Credenciales de plataforma inválidas');
    }

    // Desafío MFA si está activo
    const mfaRequired = process.env.PLATFORM_MFA_REQUIRED === 'true';
    if (mfaRequired) {
      const challengeToken = randomUUID();
      this.mfaChallenges.set(challengeToken, {
        email: adminEmail,
        adminName: 'Superadministrador Global',
        totpSecret: envTotpSecret,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });

      return {
        mfaRequired: true as const,
        challengeToken,
        email: adminEmail,
        adminName: 'Superadministrador Global',
      };
    }

    return this.generatePlatformTokens(adminEmail, 'Superadministrador Global');
  }

  async verifyMfa(dto: PlatformMfaVerifyDto) {
    const challenge = this.mfaChallenges.get(dto.challengeToken);
    if (!challenge || challenge.expiresAt < Date.now()) {
      throw new UnauthorizedException('El desafío MFA ha expirado o es inválido');
    }

    const isValid = verifyTotp(challenge.totpSecret, dto.code);
    if (!isValid) {
      throw new BadRequestException('Código TOTP de 6 dígitos inválido');
    }

    this.mfaChallenges.delete(dto.challengeToken);
    return this.generatePlatformTokens(challenge.email, challenge.adminName);
  }

  private generatePlatformTokens(email: string, fullName: string) {
    const jti = randomUUID();
    const payload = {
      sub: 'platform-admin-id',
      jti,
      tenantId: 'platform',
      role: 'SUPERADMIN',
      email,
      fullName,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '8h' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    return {
      accessToken,
      refreshToken,
      admin: {
        id: 'platform-admin-id',
        email,
        fullName,
        role: 'SUPERADMIN',
        tenantId: 'platform',
      },
    };
  }

  async getPendingTenants() {
    return this.prisma.tenant.findMany({
      where: { isActive: false },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        nitRut: true,
        businessName: true,
        tradeName: true,
        address: true,
        phone: true,
        email: true,
        createdAt: true,
      },
    });
  }

  async approveTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException(`Inquilino con ID ${tenantId} no encontrado`);
    }

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: { isActive: true },
    });
  }

  async resetOwnerPassword(tenantId: string, dto: ResetPasswordDto) {
    const owner = await this.prisma.user.findFirst({
      where: { tenantId, role: 'OWNER' },
    });

    if (!owner) {
      throw new NotFoundException(`Usuario propietario del inquilino ${tenantId} no encontrado`);
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: owner.id },
      data: { passwordHash },
    });

    return {
      success: true,
      message: `Contraseña actualizada para el propietario ${owner.email}`,
    };
  }

  async getPlatformAuditLogs() {
    return this.prisma.auditLog.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: {
        tenant: {
          select: { businessName: true, nitRut: true },
        },
      },
    });
  }
}

