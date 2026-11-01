import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from '../src/services/auth.service.js';
import { TenantService } from '../src/services/tenant.service.js';
import { UserService } from '../src/services/user.service.js';
import { BadRequestException, UnauthorizedException, ConflictException } from '@nestjs/common';

describe('Módulo de Identidad, Autenticación y RBAC (@unisaas/identity)', () => {
  const dummyJwtService = {
    signAsync: async (payload: any) => `jwt-token-${payload.sub}`,
    verifyAsync: async () => ({ sub: 'u1', tenantId: 't1', jti: 'jti-1' }),
  } as any;

  const dummySessionCache = {
    saveSession: async () => {},
    getSession: async () => ({ sessionId: 'jti-1' }),
    revokeSession: async () => true,
    getUserSessions: async () => [],
    revokeAllUserSessions: async () => 2,
  } as any;

  const dummyTokenBlacklist = {
    saveRefreshToken: async () => {},
    isRefreshTokenValid: async () => true,
    blacklistToken: async () => {},
  } as any;

  it('AuthService.login rechaza solicitudes con email o password vacíos', async () => {
    const service = new AuthService(
      {} as any,
      dummyJwtService,
      dummySessionCache,
      dummyTokenBlacklist,
    );

    await assert.rejects(
      async () => service.login({ email: '', password: '' }),
      (err: any) => err instanceof BadRequestException,
    );
  });

  it('AuthService.login rechaza usuarios no existentes con UnauthorizedException (401)', async () => {
    const mockPrisma = {
      user: {
        findFirst: async () => null,
      },
    } as any;

    const service = new AuthService(
      mockPrisma,
      dummyJwtService,
      dummySessionCache,
      dummyTokenBlacklist,
    );

    await assert.rejects(
      async () => service.login({ email: 'inexistente@unisaas.com', password: '123' }),
      (err: any) => err instanceof UnauthorizedException,
    );
  });

  it('TenantService.createTenant previene empresas con NIT duplicado', async () => {
    const mockPrisma = {
      tenant: {
        findUnique: async () => ({ id: 't1', nitRut: '900111-1' }),
      },
    } as any;

    const service = new TenantService(mockPrisma);

    await assert.rejects(
      async () => service.createTenant({
        nitRut: '900111-1',
        businessName: 'Duplicada S.A.S.',
        tradeName: 'Duplicada',
        address: 'Calle 1',
        phone: '123',
        email: 'dup@unisaas.com',
      }),
      (err: any) => err instanceof ConflictException,
    );
  });
});

