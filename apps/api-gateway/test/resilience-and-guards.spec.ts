import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GlobalHttpExceptionFilter } from '../src/common/filters/global-exception.filter.js';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard.js';
import { RedisUnavailableException } from '@unisaas/redis-client';
import { TenantContextException } from '@unisaas/database';
import { NegativeMoneyException } from '@unisaas/core-domain';
import { UnauthorizedException, ForbiddenException, HttpStatus } from '@nestjs/common';

describe('API Gateway - Resiliencia, Filtros y Guardas de Seguridad (@unisaas/api-gateway)', () => {
  describe('GlobalHttpExceptionFilter', () => {
    it('Traduce RedisUnavailableException a HTTP 503 con header Retry-After: 5', () => {
      const filter = new GlobalHttpExceptionFilter();

      let capturedStatus: number | null = null;
      let capturedHeaderName: string | null = null;
      let capturedHeaderVal: string | null = null;
      let capturedJson: any = null;

      const mockResponse: any = {
        status: (s: number) => {
          capturedStatus = s;
          return mockResponse;
        },
        header: (name: string, val: string) => {
          capturedHeaderName = name;
          capturedHeaderVal = val;
          return mockResponse;
        },
        json: (body: any) => {
          capturedJson = body;
          return mockResponse;
        },
      };

      const mockHost: any = {
        switchToHttp: () => ({
          getResponse: () => mockResponse,
          getRequest: () => ({ url: '/api/v1/auth/login' }),
        }),
      };

      filter.catch(new RedisUnavailableException('Fallo de conexión a Redis', 5), mockHost);

      assert.equal(capturedStatus, HttpStatus.SERVICE_UNAVAILABLE);
      assert.equal(capturedHeaderName, 'Retry-After');
      assert.equal(capturedHeaderVal, '5');
      assert.equal(capturedJson.statusCode, 503);
      assert.equal(capturedJson.retryAfterSeconds, 5);
    });

    it('Traduce TenantContextException a HTTP 400 Bad Request', () => {
      const filter = new GlobalHttpExceptionFilter();

      let capturedStatus: number | null = null;
      let capturedJson: any = null;

      const mockResponse: any = {
        status: (s: number) => {
          capturedStatus = s;
          return mockResponse;
        },
        header: () => mockResponse,
        json: (body: any) => {
          capturedJson = body;
          return mockResponse;
        },
      };

      const mockHost: any = {
        switchToHttp: () => ({
          getResponse: () => mockResponse,
          getRequest: () => ({ url: '/api/v1/inventory/products' }),
        }),
      };

      filter.catch(new TenantContextException('tenantId inválido'), mockHost);

      assert.equal(capturedStatus, HttpStatus.BAD_REQUEST);
      assert.equal(capturedJson.statusCode, 400);
      assert.equal(capturedJson.error, 'Bad Request');
    });

    it('Traduce DomainException a HTTP 400 Bad Request', () => {
      const filter = new GlobalHttpExceptionFilter();

      let capturedStatus: number | null = null;
      let capturedJson: any = null;

      const mockResponse: any = {
        status: (s: number) => {
          capturedStatus = s;
          return mockResponse;
        },
        header: () => mockResponse,
        json: (body: any) => {
          capturedJson = body;
          return mockResponse;
        },
      };

      const mockHost: any = {
        switchToHttp: () => ({
          getResponse: () => mockResponse,
          getRequest: () => ({ url: '/api/v1/accounting/journals' }),
        }),
      };

      filter.catch(new NegativeMoneyException('El valor monetario no puede ser negativo'), mockHost);

      assert.equal(capturedStatus, HttpStatus.BAD_REQUEST);
      assert.equal(capturedJson.statusCode, 400);
      assert.equal(capturedJson.message, 'El valor monetario no puede ser negativo');
    });
  });

  describe('JwtAuthGuard', () => {
    const reflectorMock: any = {
      getAllAndOverride: (key: string) => false,
    };

    const jwtServiceMock: any = {
      verifyAsync: async (token: string) => {
        if (token === 'valid-token') {
          return {
            sub: 'u-1',
            tenantId: 'a0000000-0000-0000-0000-000000000001',
            email: 'admin@unisaas.com',
            roles: ['CASHIER'],
            jti: 'jti-1',
          };
        }
        throw new Error('Invalid token');
      },
    };

    const sessionCacheMock: any = {
      getSession: async (jti: string) => ({ sessionId: jti }),
    };

    const tokenBlacklistMock: any = {
      isTokenBlacklisted: async (jti: string) => false,
    };

    it('Rechaza peticiones sin encabezado Authorization con 401', async () => {
      const guard = new JwtAuthGuard(
        reflectorMock,
        jwtServiceMock,
        sessionCacheMock,
        tokenBlacklistMock,
      );

      const mockContext: any = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => ({ headers: {} }),
        }),
      };

      await assert.rejects(
        async () => guard.canActivate(mockContext),
        (err: any) => err instanceof UnauthorizedException,
      );
    });

    it('Bloquea intentos de suplantar inquilino vía header X-Tenant-Id sin permisos con 403', async () => {
      const guard = new JwtAuthGuard(
        reflectorMock,
        jwtServiceMock,
        sessionCacheMock,
        tokenBlacklistMock,
      );

      const mockReq: any = {
        headers: {
          authorization: 'Bearer valid-token',
          'x-tenant-id': 'b0000000-0000-0000-0000-000000000002', // Distinto al del token (a000...01)
        },
      };

      const mockContext: any = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => mockReq,
        }),
      };

      await assert.rejects(
        async () => guard.canActivate(mockContext),
        (err: any) => err instanceof ForbiddenException,
      );
    });

    it('Permite acceso e inyecta usuario y tenantId cuando el token es válido y está verificado', async () => {
      const guard = new JwtAuthGuard(
        reflectorMock,
        jwtServiceMock,
        sessionCacheMock,
        tokenBlacklistMock,
      );

      const mockReq: any = {
        headers: {
          authorization: 'Bearer valid-token',
        },
      };

      const mockContext: any = {
        getHandler: () => {},
        getClass: () => {},
        switchToHttp: () => ({
          getRequest: () => mockReq,
        }),
      };

      const canActivate = await guard.canActivate(mockContext);

      assert.equal(canActivate, true);
      assert.equal(mockReq.tenantId, 'a0000000-0000-0000-0000-000000000001');
      assert.equal(mockReq.user.id, 'u-1');
      assert.equal(mockReq.user.email, 'admin@unisaas.com');
    });
  });
});
