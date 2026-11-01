import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaClient, withTenantContext } from '@unisaas/database';
import { SessionCacheService } from '@unisaas/redis-client';
import { randomUUID, randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { CreateUserDto } from '../dto/auth.dto.js';
import type {
  CreateStaffDto,
  UpdateProfileDto,
} from '../dto/identity-extended.dto.js';
import { ActivationService } from './activation.service.js';

const STAFF_ACTIVATION_TTL_DAYS = 7;
const ASSIGNABLE_STAFF_ROLES = ['ADMIN', 'ACCOUNTANT', 'WAREHOUSE_MANAGER', 'CASHIER'];

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly sessionCache: SessionCacheService,
    private readonly activationService: ActivationService,
  ) {}

  /**
   * Obtiene los usuarios del inquilino bajo aislamiento RLS estricto con filtros opcionales.
   */
  async getUsers(
    tenantId: string,
    filters?: { branchId?: string; role?: string; isActive?: boolean },
  ) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const where: any = {};

      if (filters?.branchId) {
        where.branchId = filters.branchId;
      }
      if (filters?.role) {
        where.role = filters.role;
      }
      if (filters?.isActive !== undefined) {
        where.isActive = filters.isActive;
      }

      return tx.user.findMany({
        where,
        select: {
          id: true,
          tenantId: true,
          branchId: true,
          documentType: true,
          documentNumber: true,
          email: true,
          fullName: true,
          phone: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          branch: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
        orderBy: { fullName: 'asc' },
      });
    });
  }

  /**
   * Obtiene un usuario específico por su ID dentro del tenant bajo RLS.
   */
  async getUserById(tenantId: string, userId: string) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const user = await tx.user.findFirst({
        where: { id: userId },
        select: {
          id: true,
          tenantId: true,
          branchId: true,
          documentType: true,
          documentNumber: true,
          email: true,
          fullName: true,
          phone: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          branch: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      });

      if (!user) {
        throw new NotFoundException(`Usuario con ID "${userId}" no encontrado.`);
      }

      return user;
    });
  }

  /**
   * Registra un nuevo usuario para el inquilino bajo aislamiento RLS estricto.
   */
  async createUser(tenantId: string, dto: CreateUserDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const userId = randomUUID();

    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const existing = await tx.user.findFirst({
        where: { email: dto.email.trim().toLowerCase() },
      });

      if (existing) {
        throw new ConflictException(`Ya existe un usuario con el correo "${dto.email}"`);
      }

      return tx.user.create({
        data: {
          id: userId,
          tenantId,
          branchId: dto.branchId,
          documentType: dto.documentType || 'CC',
          documentNumber: dto.documentNumber,
          email: dto.email.trim().toLowerCase(),
          passwordHash,
          fullName: dto.fullName,
          phone: dto.phone,
          role: dto.role,
          isActive: true,
        },
        select: {
          id: true,
          tenantId: true,
          branchId: true,
          documentType: true,
          documentNumber: true,
          email: true,
          fullName: true,
          phone: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });
    });
  }

  /**
   * Crea un colaborador (staff).
   * Si password está presente -> cuenta ACTIVE.
   * Si no -> cuenta PENDING_ACTIVATION (isActive: false) y emite código de 6 dígitos con 7 días de validez.
   */
  async createStaff(
    tenantId: string,
    dto: CreateStaffDto,
    requestedByRole?: string,
  ) {
    if (requestedByRole && !['OWNER', 'ADMIN'].includes(requestedByRole)) {
      throw new ForbiddenException('Solo OWNER o ADMIN pueden crear colaboradores.');
    }

    const role = String(dto.role ?? '').trim().toUpperCase();
    if (!ASSIGNABLE_STAFF_ROLES.includes(role)) {
      throw new BadRequestException(
        `Rol '${dto.role}' no permitido. Roles válidos: ${ASSIGNABLE_STAFF_ROLES.join(', ')}.`,
      );
    }

    const normalizedEmail = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findFirst({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw new ConflictException(`El correo electrónico '${dto.email}' ya está registrado en el sistema.`);
    }

    const userId = randomUUID();
    const hasPassword = Boolean(dto.password && dto.password.trim().length >= 8);
    const passwordHash = hasPassword
      ? await bcrypt.hash(dto.password!.trim(), 10)
      : await bcrypt.hash(randomUUID(), 10);

    const isActive = hasPassword;
    let activationCode: string | undefined;
    let activationExpiresAt: Date | undefined;

    if (!hasPassword) {
      activationCode = randomInt(100000, 999999).toString();
      const expiresAtMs = Date.now() + STAFF_ACTIVATION_TTL_DAYS * 24 * 3600 * 1000;
      activationExpiresAt = new Date(expiresAtMs);

      await this.activationService.saveActivation(
        normalizedEmail,
        {
          code: activationCode,
          userId,
          tenantId,
          branchId: dto.branchId,
          role,
          assignedRegister: dto.assignedRegister || 'CAJA-01',
          expiresAt: expiresAtMs,
        },
        STAFF_ACTIVATION_TTL_DAYS * 24 * 3600,
      );
    }

    const docNumber = `STF-${Date.now().toString().slice(-8)}`;

    const user = await withTenantContext(this.prisma, tenantId, async (tx) => {
      return tx.user.create({
        data: {
          id: userId,
          tenantId,
          branchId: dto.branchId,
          documentType: 'CC',
          documentNumber: docNumber,
          email: normalizedEmail,
          passwordHash,
          fullName: dto.fullName.trim(),
          phone: dto.phone?.trim() || null,
          role: role as any,
          isActive,
        },
        select: {
          id: true,
          tenantId: true,
          branchId: true,
          email: true,
          fullName: true,
          phone: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });
    });

    return {
      success: true,
      user,
      activationCode,
      activationExpiresAt,
      username: dto.username || normalizedEmail.split('@')[0],
    };
  }

  /**
   * Actualiza el perfil personal o de un usuario dentro del tenant bajo RLS.
   */
  async updateProfile(tenantId: string, userId: string, dto: UpdateProfileDto) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const existing = await tx.user.findFirst({
        where: { id: userId },
      });

      if (!existing) {
        throw new NotFoundException(`Usuario con ID '${userId}' no encontrado.`);
      }

      return tx.user.update({
        where: { id: userId },
        data: {
          fullName: dto.fullName ?? existing.fullName,
          phone: dto.phone ?? existing.phone,
          documentType: (dto.documentType as any) ?? existing.documentType,
          documentNumber: dto.documentNumber ?? existing.documentNumber,
        },
        select: {
          id: true,
          tenantId: true,
          branchId: true,
          email: true,
          fullName: true,
          phone: true,
          documentType: true,
          documentNumber: true,
          role: true,
          isActive: true,
          updatedAt: true,
        },
      });
    });
  }

  /**
   * Activa o suspende el estado de un usuario, revocando sesiones si es suspendido.
   */
  async updateStatus(
    tenantId: string,
    userId: string,
    isActive: boolean,
    requestedById?: string,
  ) {
    if (requestedById && requestedById === userId && !isActive) {
      throw new BadRequestException('No puedes suspender tu propia cuenta de sesión activa.');
    }

    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const user = await tx.user.findFirst({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException(`Usuario con ID '${userId}' no encontrado.`);
      }

      if (!isActive && user.role === 'OWNER') {
        const otherOwners = await tx.user.count({
          where: { tenantId, role: 'OWNER', isActive: true, id: { not: userId } },
        });
        if (otherOwners === 0) {
          throw new ForbiddenException(
            'No se puede suspender al último OWNER activo del comercio. Asigne otro OWNER primero.',
          );
        }
      }

      const updated = await tx.user.update({
        where: { id: userId },
        data: { isActive },
      });

      if (!isActive) {
        await this.sessionCache.revokeAllUserSessions(tenantId, userId);
      }

      return updated;
    });
  }

  /**
   * Cambia el rol de un usuario con validaciones de privilegios y revocación de sesiones.
   */
  async assignRole(
    tenantId: string,
    userId: string,
    newRole: string,
    assignedByRole?: string,
    requestedById?: string,
  ) {
    if (assignedByRole !== 'OWNER' && assignedByRole !== 'ADMIN') {
      throw new ForbiddenException('Solo OWNER o ADMIN pueden asignar roles.');
    }

    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const user = await tx.user.findFirst({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException(`Usuario con ID '${userId}' no encontrado.`);
      }

      if (assignedByRole === 'ADMIN') {
        if (user.role === 'OWNER' || newRole === 'OWNER') {
          throw new ForbiddenException('ADMIN no puede modificar ni asignar el rol OWNER.');
        }
      }

      if (user.role === 'OWNER' && newRole !== 'OWNER') {
        const otherOwners = await tx.user.count({
          where: { tenantId, role: 'OWNER', isActive: true, id: { not: userId } },
        });
        if (otherOwners === 0) {
          throw new ForbiddenException(
            'No se puede degradar al último OWNER activo del comercio. Asigne otro OWNER primero.',
          );
        }
      }

      const updated = await tx.user.update({
        where: { id: userId },
        data: { role: newRole as any },
      });

      // Revocar sesiones activas para forzar recarga de JWT con nuevo rol
      await this.sessionCache.revokeAllUserSessions(tenantId, userId);

      return updated;
    });
  }

  /**
   * Restablece la contraseña de un usuario y revoca todas sus sesiones activas.
   */
  async resetPassword(
    tenantId: string,
    userId: string,
    newPassword: string,
    requestedByRole?: string,
  ) {
    if (!newPassword || newPassword.trim().length < 8) {
      throw new BadRequestException('La nueva contraseña debe contener al menos 8 caracteres.');
    }

    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const user = await tx.user.findFirst({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException(`Usuario con ID '${userId}' no encontrado.`);
      }

      if (user.role === 'OWNER' && requestedByRole !== 'OWNER') {
        throw new ForbiddenException('Un usuario con rol ADMIN no puede restablecer la contraseña del propietario (OWNER).');
      }

      const passwordHash = await bcrypt.hash(newPassword.trim(), 10);
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash },
      });

      await this.sessionCache.revokeAllUserSessions(tenantId, userId);

      return { success: true, message: 'Contraseña restablecida exitosamente.' };
    });
  }

  /**
   * Regenera el código de activación temporal de 6 dígitos para un usuario.
   */
  async resetActivationCode(
    tenantId: string,
    userId: string,
    requestedByRole?: string,
  ) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const user = await tx.user.findFirst({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException(`Usuario con ID '${userId}' no encontrado.`);
      }

      if (user.role === 'OWNER' && requestedByRole !== 'OWNER') {
        throw new ForbiddenException('Un usuario ADMIN no puede regenerar el código del propietario.');
      }

      const activationCode = randomInt(100000, 999999).toString();
      const expiresAtMs = Date.now() + STAFF_ACTIVATION_TTL_DAYS * 24 * 3600 * 1000;
      const activationExpiresAt = new Date(expiresAtMs);

      await this.activationService.saveActivation(
        user.email,
        {
          code: activationCode,
          userId: user.id,
          tenantId,
          branchId: user.branchId,
          role: user.role,
          expiresAt: expiresAtMs,
        },
        STAFF_ACTIVATION_TTL_DAYS * 24 * 3600,
      );

      await tx.user.update({
        where: { id: userId },
        data: { isActive: false },
      });

      await this.sessionCache.revokeAllUserSessions(tenantId, userId);

      return {
        success: true,
        activationCode,
        expiresAt: activationExpiresAt,
      };
    });
  }

  /**
   * Soft-delete de usuario: desactiva cuenta y revoca sesiones en Redis.
   */
  async softDelete(tenantId: string, userId: string, requestedById?: string) {
    if (requestedById && requestedById === userId) {
      throw new BadRequestException('No puedes eliminar tu propia cuenta de sesión activa.');
    }

    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const user = await tx.user.findFirst({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException(`Usuario con ID '${userId}' no encontrado.`);
      }

      if (user.role === 'OWNER') {
        const otherOwners = await tx.user.count({
          where: { tenantId, role: 'OWNER', isActive: true, id: { not: userId } },
        });
        if (otherOwners === 0) {
          throw new ForbiddenException(
            'No se puede eliminar al último OWNER activo del comercio. Asigne otro OWNER primero.',
          );
        }
      }

      await tx.user.update({
        where: { id: userId },
        data: { isActive: false },
      });

      await this.sessionCache.revokeAllUserSessions(tenantId, userId);

      return { success: true, message: 'Usuario desactivado correctamente.' };
    });
  }

  /**
   * Consulta el rastro de auditoría de un usuario.
   */
  async getAuditTrail(tenantId: string, userId: string, page = 1, limit = 20) {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;

    const [total, events] = await Promise.all([
      this.prisma.auditLog.count({
        where: { tenantId, userId },
      }),
      this.prisma.auditLog.findMany({
        where: { tenantId, userId },
        take,
        skip,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      total,
      page,
      limit: take,
      totalPages: Math.ceil(total / take),
      events,
    };
  }
}
