import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { SessionCacheService, TokenBlacklistService } from '@unisaas/redis-client';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly sessionCache: SessionCacheService,
    private readonly tokenBlacklist: TokenBlacklistService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Encabezado de autorización ausente o con formato inválido');
    }

    const token = authHeader.substring(7).trim();

    let payload: {
      sub: string;
      tenantId: string;
      email: string;
      roles: string[];
      jti?: string;
      branchId?: string;
    };

    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET || 'unisaas-jwt-secret-key-32-chars-min',
      });
    } catch {
      throw new UnauthorizedException('Token de autenticación inválido o expirado');
    }

    if (!payload.sub || !payload.tenantId) {
      throw new UnauthorizedException('Payload de token corrupto (sub o tenantId ausentes)');
    }

    // 1. Validar lista negra de tokens revocados (si tiene jti)
    if (payload.jti) {
      // Las excepciones de transporte de Redis se propagan como RedisUnavailableException (503)
      const isBlacklisted = await this.tokenBlacklist.isTokenBlacklisted(payload.jti);
      if (isBlacklisted) {
        throw new UnauthorizedException('El token ha sido revocado');
      }

      // 2. Validar que la sesión siga activa en Redis
      const session = await this.sessionCache.getSession(payload.jti);
      if (!session) {
        throw new UnauthorizedException('La sesión ha expirado o fue cerrada');
      }
    }

    // 3. Blindaje de Inquilino: Validar header X-Tenant-Id frente a la identidad real
    const requestedTenantId = request.headers['x-tenant-id'];
    if (requestedTenantId && requestedTenantId !== payload.tenantId) {
      const isSuperAdmin = payload.roles && payload.roles.includes('SUPERADMIN');
      if (!isSuperAdmin) {
        throw new ForbiddenException(
          'Acceso denegado: No está autorizado para operar bajo el inquilino solicitado',
        );
      }
    }

    // 4. Inyectar contexto criptográficamente verificado en la petición
    request.user = {
      id: payload.sub,
      email: payload.email,
      tenantId: payload.tenantId,
      roles: payload.roles || [],
      branchId: payload.branchId,
      jti: payload.jti || '',
    };
    request.tenantId = payload.tenantId;

    return true;
  }
}

