import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@unisaas/database';
import { SessionCacheService, TokenBlacklistService } from '@unisaas/redis-client';
import type { LoginDto, RefreshTokenDto } from '../dto/auth.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly jwtService: JwtService,
    private readonly sessionCache: SessionCacheService,
    private readonly tokenBlacklist: TokenBlacklistService,
  ) {}

  /**
   * Autenticación canónica contra PostgreSQL y registro de sesión en Redis.
   */
  async login(dto: LoginDto): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    user: {
      id: string;
      email: string;
      fullName: string;
      role: string;
      tenantId: string;
      branchId: string | null;
    };
  }> {
    if (!dto.email || !dto.password) {
      throw new BadRequestException('El correo y la contraseña son obligatorios');
    }

    const normalizedEmail = dto.email.trim().toLowerCase();

    // 1. Buscar usuario global por email para identificar su inquilino
    const user = await this.prisma.user.findFirst({
      where: { email: normalizedEmail, isActive: true },
      include: { tenant: true },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.tenant.isActive) {
      throw new UnauthorizedException('La empresa se encuentra inactiva o suspendida');
    }

    // 2. Comprobar contraseña
    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // 3. Generar identificador único de sesión (jti)
    const jti = randomUUID();
    const refreshJti = randomUUID();

    const payload = {
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      roles: [user.role],
      branchId: user.branchId,
      jti,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: '15m',
    });

    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, tenantId: user.tenantId, jti: refreshJti },
      { expiresIn: '7d' },
    );

    // 4. Registrar sesión en Redis mediante SessionCacheService (ZSET)
    const now = Date.now();
    await this.sessionCache.saveSession({
      sessionId: jti,
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      roles: [user.role],
      createdAt: now,
      expiresAt: now + 86400 * 1000,
    });

    // 5. Registrar refresh token en Redis
    await this.tokenBlacklist.saveRefreshToken(refreshJti, {
      userId: user.id,
      tenantId: user.tenantId,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        tenantId: user.tenantId,
        branchId: user.branchId,
      },
    };
  }

  /**
   * Renovación de token de acceso mediante refresh token válido.
   */
  async refreshToken(dto: RefreshTokenDto): Promise<{ accessToken: string; expiresIn: number }> {
    if (!dto.refreshToken) {
      throw new BadRequestException('El refresh token es obligatorio');
    }

    let payload: { sub: string; tenantId: string; jti: string };
    try {
      payload = await this.jwtService.verifyAsync(dto.refreshToken);
    } catch {
      throw new UnauthorizedException('Refresh token expirado o inválido');
    }

    const isValid = await this.tokenBlacklist.isRefreshTokenValid(payload.jti);
    if (!isValid) {
      throw new UnauthorizedException('Refresh token revocado o inexistente');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Usuario no disponible');
    }

    const newJti = randomUUID();
    const newAccessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        tenantId: user.tenantId,
        email: user.email,
        roles: [user.role],
        branchId: user.branchId,
        jti: newJti,
      },
      { expiresIn: '15m' },
    );

    // Registrar la nueva sesión activa en Redis
    const now = Date.now();
    await this.sessionCache.saveSession({
      sessionId: newJti,
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      roles: [user.role],
      createdAt: now,
      expiresAt: now + 86400 * 1000,
    });

    return {
      accessToken: newAccessToken,
      expiresIn: 900,
    };
  }

  /**
   * Cierre de sesión individual: Blacklist del JWT y revocación de sesión.
   */
  async logout(tenantId: string, userId: string, jti: string): Promise<void> {
    if (jti) {
      await this.tokenBlacklist.blacklistToken(jti, 900);
      await this.sessionCache.revokeSession(tenantId, userId, jti);
    }
  }

  /**
   * Consulta las sesiones activas del usuario desde el índice ZSET.
   */
  async getUserSessions(tenantId: string, userId: string) {
    return this.sessionCache.getUserSessions(tenantId, userId);
  }

  /**
   * Revoca masivamente todas las sesiones activas del usuario en tiempo O(M).
   */
  async revokeAllUserSessions(tenantId: string, userId: string): Promise<number> {
    return this.sessionCache.revokeAllUserSessions(tenantId, userId);
  }
}

