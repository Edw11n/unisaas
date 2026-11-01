import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient, withTenantContext } from '@unisaas/database';
import { SessionCacheService, TokenBlacklistService } from '@unisaas/redis-client';
import type { LoginDto, RefreshTokenDto } from '../dto/auth.dto.js';
import type { RegisterDto, ActivateAccountDto } from '../dto/identity-extended.dto.js';
import { CommercialCategoriesService } from './commercial-categories.service.js';
import { PlansService } from './plans.service.js';
import { ActivationService } from './activation.service.js';

interface ActivationAttemptEntry {
  attempts: number;
  lockedUntil?: number;
}

const ACTIVATION_MAX_ATTEMPTS = 5;
const ACTIVATION_WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly activationAttempts = new Map<string, ActivationAttemptEntry>();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly jwtService: JwtService,
    private readonly sessionCache: SessionCacheService,
    private readonly tokenBlacklist: TokenBlacklistService,
    private readonly categoriesService: CommercialCategoriesService,
    private readonly plansService: PlansService,
    private readonly activationService: ActivationService,
  ) {}

  /**
   * Registro integral y atómico de comercio, propietario, sucursal y bodega.
   */
  async register(dto: RegisterDto) {
    const normalizedEmail = (dto.email || '').trim().toLowerCase();
    if (!normalizedEmail || !dto.password) {
      throw new BadRequestException('El correo y la contraseña son obligatorios');
    }

    // 1. Validar unicidad global del correo
    const existingUser = await this.prisma.user.findFirst({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      throw new ConflictException(
        `El correo electrónico ${dto.email} ya se encuentra registrado en el sistema.`,
      );
    }

    // 2. Validar unicidad de NIT/RUT si se especifica
    const nitRut = (dto.nitRut || `PROV-${Date.now().toString().slice(-8)}`).trim();
    const existingTenant = await this.prisma.tenant.findFirst({
      where: { nitRut },
    });
    if (existingTenant) {
      throw new ConflictException(
        `El NIT/RUT ${nitRut} ya se encuentra registrado en el sistema.`,
      );
    }

    const tenantId = randomUUID();
    const branchId = randomUUID();
    const warehouseId = randomUUID();
    const userId = randomUUID();

    const categoryDef = this.categoriesService.findByCode(dto.commercialCategory || 'TIENDA_BARRIO');
    const address = (dto.address || 'Sede Principal').trim();
    const businessPhone = (dto.businessPhone || dto.ownerPhone || '').trim();
    const fullName = `${dto.ownerFirstName || ''} ${dto.ownerLastName || ''}`.trim() || 'Propietario';
    const docType = dto.documentType || 'CC';
    const docNumber = (dto.documentNumber || `DOC-${Date.now().toString().slice(-8)}`).trim();

    const passwordHash = await bcrypt.hash(dto.password, 10);

    // 3. Ejecución atómica en PostgreSQL garantizando cero estados huérfanos con contexto RLS
    await withTenantContext(this.prisma, tenantId, async (tx) => {
      // 3.1. Insertar Tenant
      await tx.tenant.create({
        data: {
          id: tenantId,
          nitRut,
          businessName: dto.businessName.trim(),
          tradeName: dto.tradeName.trim(),
          address,
          phone: businessPhone,
          email: normalizedEmail,
          countryCode: dto.countryCode || 'COL',
          currencyCode: dto.currencyCode || 'COP',
          taxRegime: (dto.taxRegime as any) || 'REGIMEN_SIMPLE',
          isActive: true,
        },
      });

      // 3.2. Insertar Sucursal Principal
      await tx.branch.create({
        data: {
          id: branchId,
          tenantId,
          code: 'BR01',
          name: 'Sede Principal',
          address,
          phone: businessPhone,
          isActive: true,
        },
      });

      // 3.3. Insertar Bodega Principal asociada
      await tx.warehouse.create({
        data: {
          id: warehouseId,
          tenantId,
          branchId,
          code: 'BOD01',
          name: 'Bodega Principal',
          status: 'ACTIVE',
        },
      });

      // 3.4. Insertar Usuario OWNER
      await tx.user.create({
        data: {
          id: userId,
          tenantId,
          branchId,
          documentType: (docType as any) || 'CC',
          documentNumber: docNumber,
          email: normalizedEmail,
          passwordHash,
          fullName,
          phone: dto.ownerPhone.trim(),
          role: 'OWNER',
          isActive: true,
        },
      });

      // 3.5. Bootstrap idempotente si existe en BD
      try {
        await tx.$executeRawUnsafe('SELECT seed_tenant_bootstrap($1);', tenantId);
      } catch {
        // Ignorar si la función no está disponible en la base de datos
      }
    });

    // 4. Asignar plan por defecto (PILOT_UNLIMITED)
    this.plansService.assignPlanToTenant(tenantId, 'PILOT_UNLIMITED');

    // 5. Emitir sesión JWT inmediata para acceso directo
    const jti = randomUUID();
    const refreshJti = randomUUID();
    const basePayload = {
      sub: userId,
      tenantId,
      branchId,
      role: 'OWNER',
      roles: ['OWNER'],
      email: normalizedEmail,
      jti,
    };

    const accessToken = await this.jwtService.signAsync(basePayload, { expiresIn: '8h' });
    const refreshToken = await this.jwtService.signAsync(
      { sub: userId, tenantId, jti: refreshJti },
      { expiresIn: '7d' },
    );

    const now = Date.now();
    await this.sessionCache.saveSession({
      sessionId: jti,
      userId,
      tenantId,
      email: normalizedEmail,
      roles: ['OWNER'],
      createdAt: now,
      expiresAt: now + 86400 * 1000,
    });

    await this.tokenBlacklist.saveRefreshToken(refreshJti, {
      userId,
      tenantId,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 28800,
      tenant: {
        id: tenantId,
        businessName: dto.businessName.trim(),
        tradeName: dto.tradeName.trim(),
        nitRut,
        category: categoryDef.code,
        capabilities: categoryDef.capabilities,
      },
      branch: {
        id: branchId,
        name: 'Sede Principal',
        code: 'BR01',
      },
      warehouse: {
        id: warehouseId,
        name: 'Bodega Principal',
        code: 'BOD01',
      },
      user: {
        id: userId,
        email: normalizedEmail,
        fullName,
        phone: dto.ownerPhone.trim(),
        role: 'OWNER',
        tenantId,
        branchId,
      },
    };
  }

  /**
   * Activación pública de colaboradores con código temporal de 6 dígitos.
   */
  async activateAccount(dto: ActivateAccountDto) {
    const email = String(dto.email ?? '').trim().toLowerCase();
    const code = String(dto.activationCode ?? '').trim();
    const newPassword = String(dto.newPassword ?? '');

    if (!email || !code || newPassword.length < 8) {
      throw new BadRequestException(
        'Correo, código de activación y una contraseña de al menos 8 caracteres son obligatorios.',
      );
    }

    const rateKey = `${dto.clientIp || 'unknown'}:${email}`;
    const now = Date.now();
    const entry = this.activationAttempts.get(rateKey);

    if (entry?.lockedUntil && entry.lockedUntil > now) {
      const remainingSec = Math.ceil((entry.lockedUntil - now) / 1000);
      throw new BadRequestException(
        `Demasiados intentos de activación. Reintente en ${remainingSec} segundos.`,
      );
    }

    const activation = await this.activationService.getActivation(email);
    if (!activation || activation.code !== code || activation.expiresAt < now) {
      const current = this.activationAttempts.get(rateKey) || { attempts: 0 };
      current.attempts += 1;
      if (current.attempts >= ACTIVATION_MAX_ATTEMPTS) {
        current.lockedUntil = now + ACTIVATION_WINDOW_MS;
        current.attempts = 0;
      }
      this.activationAttempts.set(rateKey, current);

      throw new BadRequestException(
        'No se pudo activar la cuenta: código inválido o expirado, o la cuenta no está pendiente de activación.',
      );
    }

    // Usuario válido: actualizar estado y contraseña en PostgreSQL
    const user = await this.prisma.user.findFirst({
      where: { email },
    });

    if (!user) {
      throw new BadRequestException(
        'No se pudo activar la cuenta: usuario no encontrado.',
      );
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        isActive: true,
      },
    });

    // Limpiar código de activación y rate limit
    await this.activationService.deleteActivation(email);
    this.activationAttempts.delete(rateKey);

    return {
      success: true,
      message: 'Cuenta activada correctamente. Ya puedes iniciar sesión con tu email y contraseña.',
      user: {
        id: updatedUser.id,
        tenantId: updatedUser.tenantId,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        role: updatedUser.role,
      },
    };
  }

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
      role: user.role,
      roles: [user.role],
      branchId: user.branchId,
      jti,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: '8h',
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
      expiresIn: 28800,
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
        role: user.role,
        roles: [user.role],
        branchId: user.branchId,
        jti: newJti,
      },
      { expiresIn: '8h' },
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
      expiresIn: 28800,
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
