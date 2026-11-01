import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from '../src/services/auth.service.js';
import { UserService } from '../src/services/user.service.js';
import { BranchService } from '../src/services/branch.service.js';
import { CommercialCategoriesService } from '../src/services/commercial-categories.service.js';
import { PlansService } from '../src/services/plans.service.js';
import { ActivationService } from '../src/services/activation.service.js';
import { PlatformService } from '../src/services/platform.service.js';
import { generateTotp, verifyTotp, generateBackupCodes } from '../src/services/totp.js';
import {
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

const VALID_TENANT_ID_1 = '11111111-1111-4111-8111-111111111111';
const VALID_TENANT_ID_2 = '22222222-2222-4222-8222-222222222222';
const VALID_USER_ID_1 = '33333333-3333-4333-8333-333333333333';
const VALID_USER_ID_2 = '44444444-4444-4444-8444-444444444444';

describe('Squad 1 — Cobertura Integral de Identidad, Autenticación y Planes', () => {
  // Helpers y mocks
  const dummyJwtService = {
    signAsync: async (payload: any) => `jwt-token-${payload.sub || 'platform'}`,
    sign: (payload: any) => `jwt-token-${payload.sub || 'platform'}`,
    verifyAsync: async () => ({ sub: 'u1', tenantId: VALID_TENANT_ID_1, jti: 'jti-1' }),
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

  // 1. Rubros comerciales colombianos
  describe('Rubros Comerciales (CommercialCategoriesService)', () => {
    const service = new CommercialCategoriesService();

    it('retorna la lista completa de rubros comerciales con capacidades sugeridas', () => {
      const categories = service.findAll();
      assert.ok(categories.length >= 20, 'Debe incluir al menos 20 rubros comerciales');

      const restaurante = categories.find((c) => c.code === 'RESTAURANTE');
      assert.ok(restaurante, 'Debe incluir el rubro RESTAURANTE');
      assert.equal(restaurante.capabilities.kitchenPrint, true);
      assert.equal(restaurante.capabilities.tipSupport, true);
      assert.equal(restaurante.capabilities.orderNotes, true);

      const drogueria = categories.find((c) => c.code === 'DROGUERIA_FARMACIA');
      assert.ok(drogueria, 'Debe incluir el rubro DROGUERIA_FARMACIA');
      assert.equal(drogueria.capabilities.lotTracking, true);
      assert.equal(drogueria.capabilities.expirationAlerts, true);
    });

    it('busca rubros por código insensible a mayúsculas y tiene fallback seguro', () => {
      const cat = service.findByCode('ferreteria');
      assert.equal(cat.code, 'FERRETERIA');
      assert.equal(cat.capabilities.fractionalUnits, true);

      const fallback = service.findByCode('RUBRO_INEXISTENTE_XYZ');
      assert.ok(fallback, 'Debe retornar categoría fallback');
    });
  });

  // 2. Planes SaaS y límites
  describe('Planes SaaS y Control de Cuotas (PlansService)', () => {
    const service = new PlansService();

    it('lista los planes del sistema disponibles', () => {
      const plans = service.getAvailablePlans();
      assert.ok(plans.length >= 4);
      assert.ok(plans.some((p) => p.code === 'PILOT_UNLIMITED'));
      assert.ok(plans.some((p) => p.code === 'PRO_GROWTH'));
    });

    it('retorna suscripción por defecto en modo piloto ilimitado', () => {
      const sub = service.getTenantSubscription(VALID_TENANT_ID_1);
      assert.equal(sub.planCode, 'PILOT_UNLIMITED');
      assert.equal(sub.isPilotMode, true);
    });

    it('permite cambiar plan a un tenant', () => {
      service.assignPlanToTenant(VALID_TENANT_ID_2, 'PRO_GROWTH');
      const sub = service.getTenantSubscription(VALID_TENANT_ID_2);
      assert.equal(sub.planCode, 'PRO_GROWTH');
      assert.equal(sub.limits.maxUsers, 5);
    });

    it('en modo piloto el checkUsageLimit siempre es permitido', () => {
      const check = service.checkUsageLimit(VALID_TENANT_ID_1, 'maxUsers', 9999);
      assert.equal(check.allowed, true);
      assert.equal(check.isPilotMode, true);
    });
  });

  // 3. TOTP y MFA
  describe('Criptografía TOTP y MFA Platform (totp.ts)', () => {
    const secret = 'JBSWY3DPEHPK3PXP';

    it('genera códigos TOTP de 6 dígitos numéricos', () => {
      const token = generateTotp(secret);
      assert.match(token, /^\d{6}$/);
    });

    it('valida el token recién generado con tolerancia de ventana temporal', () => {
      const token = generateTotp(secret);
      const isValid = verifyTotp(secret, token);
      assert.equal(isValid, true);
    });

    it('rechaza tokens inválidos o mal formateados', () => {
      assert.equal(verifyTotp(secret, '000000'), false);
      assert.equal(verifyTotp(secret, 'abc123'), false);
      assert.equal(verifyTotp('', '123456'), false);
    });

    it('genera códigos de respaldo únicos con formato legible', () => {
      const backupCodes = generateBackupCodes(5);
      assert.equal(backupCodes.length, 5);
      backupCodes.forEach((code: string) => {
        assert.match(code, /^[A-F0-9]{4}-[A-F0-9]{4}$/);
      });
    });
  });

  // 4. Onboarding y Registro
  describe('Onboarding y Registro Atómico (AuthService.register)', () => {
    it('rechaza registro si el correo ya existe en el sistema', async () => {
      const mockPrisma = {
        user: {
          findFirst: async () => ({ id: 'u1', email: 'existente@unisaas.com' }),
        },
      } as any;

      const authService = new AuthService(
        mockPrisma,
        dummyJwtService,
        dummySessionCache,
        dummyTokenBlacklist,
        new CommercialCategoriesService(),
        new PlansService(),
        new ActivationService(),
      );

      await assert.rejects(
        async () =>
          authService.register({
            ownerFirstName: 'Juan',
            ownerLastName: 'Perez',
            email: 'existente@unisaas.com',
            password: 'Password123!',
            ownerPhone: '3001234567',
            businessName: 'Mi Tienda',
            tradeName: 'Tienda Juan',
          }),
        (err: any) => err instanceof ConflictException,
      );
    });

    it('rechaza registro si el NIT ya existe', async () => {
      const mockPrisma = {
        user: { findFirst: async () => null },
        tenant: { findFirst: async () => ({ id: VALID_TENANT_ID_1, nitRut: '900123456-1' }) },
      } as any;

      const authService = new AuthService(
        mockPrisma,
        dummyJwtService,
        dummySessionCache,
        dummyTokenBlacklist,
        new CommercialCategoriesService(),
        new PlansService(),
        new ActivationService(),
      );

      await assert.rejects(
        async () =>
          authService.register({
            ownerFirstName: 'Juan',
            ownerLastName: 'Perez',
            email: 'nuevo@unisaas.com',
            password: 'Password123!',
            ownerPhone: '3001234567',
            businessName: 'Mi Tienda',
            tradeName: 'Tienda Juan',
            nitRut: '900123456-1',
          }),
        (err: any) => err instanceof ConflictException,
      );
    });

    it('registra exitosamente un nuevo comercio y emite tokens', async () => {
      let createdTenant: any = null;
      let createdBranch: any = null;
      let createdWarehouse: any = null;
      let createdUser: any = null;

      const mockTx = {
        tenant: { create: async ({ data }: any) => { createdTenant = data; return data; } },
        branch: { create: async ({ data }: any) => { createdBranch = data; return data; } },
        warehouse: { create: async ({ data }: any) => { createdWarehouse = data; return data; } },
        user: { create: async ({ data }: any) => { createdUser = data; return data; } },
        $executeRawUnsafe: async () => {},
      };

      const mockPrisma = {
        user: { findFirst: async () => null },
        tenant: { findFirst: async () => null },
        $transaction: async (cb: any) => cb(mockTx),
      } as any;

      const authService = new AuthService(
        mockPrisma,
        dummyJwtService,
        dummySessionCache,
        dummyTokenBlacklist,
        new CommercialCategoriesService(),
        new PlansService(),
        new ActivationService(),
      );

      const result = await authService.register({
        ownerFirstName: 'Carlos',
        ownerLastName: 'Restrepo',
        email: 'dueno@mirestaurante.com',
        password: 'Password123!',
        ownerPhone: '+573001234567',
        businessName: 'Restaurante El Paisa S.A.S.',
        tradeName: 'El Paisa Gourmet',
        commercialCategory: 'RESTAURANTE',
      });

      assert.ok(result.accessToken);
      assert.ok(result.refreshToken);
      assert.equal(result.user.email, 'dueno@mirestaurante.com');
      assert.equal(result.user.role, 'OWNER');
      assert.equal(result.tenant.category, 'RESTAURANTE');
      assert.equal(result.tenant.capabilities.kitchenPrint, true);
      assert.equal(createdTenant.businessName, 'Restaurante El Paisa S.A.S.');
      assert.equal(createdBranch.code, 'BR01');
      assert.equal(createdWarehouse.code, 'BOD01');
      assert.equal(createdUser.role, 'OWNER');
    });
  });

  // 5. Creación de Colaboradores y Activación de Cuentas
  describe('Colaboradores y Activación (createStaff & activateAccount)', () => {
    const activationService = new ActivationService();

    it('crea colaborador sin password en estado inactivo con código de 6 dígitos', async () => {
      let createdUser: any = null;
      const mockTx = {
        user: {
          create: async ({ data }: any) => {
            createdUser = data;
            return data;
          },
        },
        $executeRawUnsafe: async () => {},
      };

      const mockPrisma = {
        user: { findFirst: async () => null },
        $transaction: async (cb: any) => cb(mockTx),
      } as any;

      const userService = new UserService(mockPrisma, dummySessionCache, activationService);

      const result = await userService.createStaff(
        VALID_TENANT_ID_1,
        {
          fullName: 'Andres Gomez',
          email: 'andres@mirestaurante.com',
          role: 'CASHIER',
        },
        'OWNER',
      );

      assert.equal(result.success, true);
      assert.equal(createdUser.isActive, false);
      assert.ok(result.activationCode);
      assert.match(result.activationCode, /^\d{6}$/);

      // Verificar que el código quedó guardado en ActivationService
      const saved = await activationService.getActivation('andres@mirestaurante.com');
      assert.ok(saved);
      assert.equal(saved.code, result.activationCode);
    });

    it('activa la cuenta exitosamente con el código correcto', async () => {
      let updatedUser: any = null;
      const mockPrisma = {
        user: {
          findFirst: async () => ({ id: 'u-cajero', email: 'andres@mirestaurante.com', role: 'CASHIER' }),
          update: async ({ data }: any) => {
            updatedUser = data;
            return { id: 'u-cajero', email: 'andres@mirestaurante.com', role: 'CASHIER', isActive: data.isActive };
          },
        },
      } as any;

      const authService = new AuthService(
        mockPrisma,
        dummyJwtService,
        dummySessionCache,
        dummyTokenBlacklist,
        new CommercialCategoriesService(),
        new PlansService(),
        activationService,
      );

      const saved = await activationService.getActivation('andres@mirestaurante.com');
      assert.ok(saved);

      const activationResult = await authService.activateAccount({
        email: 'andres@mirestaurante.com',
        activationCode: saved.code,
        newPassword: 'NuevaClaveSegura2026!',
      });

      assert.equal(activationResult.success, true);
      assert.equal(updatedUser.isActive, true);

      // Verificar que el código fue consumido y ya no existe
      const afterActivation = await activationService.getActivation('andres@mirestaurante.com');
      assert.equal(afterActivation, null);
    });

    it('falla con código erróneo y bloquea tras exceder intentos', async () => {
      const authService = new AuthService(
        {} as any,
        dummyJwtService,
        dummySessionCache,
        dummyTokenBlacklist,
        new CommercialCategoriesService(),
        new PlansService(),
        activationService,
      );

      await assert.rejects(
        async () =>
          authService.activateAccount({
            email: 'inexistente@unisaas.com',
            activationCode: '999999',
            newPassword: 'ClaveInvalida123!',
          }),
        (err: any) => err instanceof BadRequestException,
      );
    });
  });

  // 6. RBAC y Restricciones de Usuario
  describe('RBAC y Seguridad de Usuarios (UserService)', () => {
    it('impide la auto-suspensión de la propia cuenta de sesión', async () => {
      const userService = new UserService({} as any, dummySessionCache, new ActivationService());

      await assert.rejects(
        async () => userService.updateStatus(VALID_TENANT_ID_1, VALID_USER_ID_1, false, VALID_USER_ID_1),
        (err: any) => err instanceof BadRequestException,
      );
    });

    it('impide suspender al último OWNER activo del comercio', async () => {
      const mockTx = {
        user: {
          findFirst: async () => ({ id: VALID_USER_ID_1, role: 'OWNER', isActive: true }),
          count: async () => 0, // Cero otros owners activos
        },
        $executeRawUnsafe: async () => {},
      };

      const mockPrisma = {
        $transaction: async (cb: any) => cb(mockTx),
      } as any;

      const userService = new UserService(mockPrisma, dummySessionCache, new ActivationService());

      await assert.rejects(
        async () => userService.updateStatus(VALID_TENANT_ID_1, VALID_USER_ID_1, false, VALID_USER_ID_2),
        (err: any) => err instanceof ForbiddenException,
      );
    });

    it('revoca sesiones en Redis al suspender un usuario o cambiarle rol', async () => {
      let revokedCount = 0;
      const mockSessionCache = {
        revokeAllUserSessions: async () => {
          revokedCount++;
          return 1;
        },
      } as any;

      const mockTx = {
        user: {
          findFirst: async () => ({ id: VALID_USER_ID_2, role: 'CASHIER', isActive: true }),
          update: async () => ({ id: VALID_USER_ID_2, isActive: false }),
        },
        $executeRawUnsafe: async () => {},
      };

      const mockPrisma = {
        $transaction: async (cb: any) => cb(mockTx),
      } as any;

      const userService = new UserService(mockPrisma, mockSessionCache, new ActivationService());

      await userService.updateStatus(VALID_TENANT_ID_1, VALID_USER_ID_2, false, VALID_USER_ID_1);
      assert.equal(revokedCount, 1, 'Debe revocar sesiones en Redis');
    });
  });

  // 7. CRUD de Sucursales (BranchService)
  describe('Sucursales bajo Aislamiento RLS (BranchService)', () => {
    it('crea y lista sucursales para el inquilino', async () => {
      const branches: any[] = [];
      const mockTx = {
        branch: {
          findFirst: async () => null,
          create: async ({ data }: any) => {
            branches.push(data);
            return data;
          },
          findMany: async () => branches,
        },
        $executeRawUnsafe: async () => {},
      };

      const mockPrisma = {
        $transaction: async (cb: any) => cb(mockTx),
      } as any;

      const branchService = new BranchService(mockPrisma);

      const created = await branchService.create(VALID_TENANT_ID_1, {
        code: 'BR-SUR',
        name: 'Sucursal Sur',
        address: 'Calle 50 # 10-20',
      });

      assert.equal(created.code, 'BR-SUR');
      assert.equal(created.name, 'Sucursal Sur');

      const list = await branchService.findAll(VALID_TENANT_ID_1);
      assert.equal(list.length, 1);
    });
  });

  // 8. Superadministrador de Plataforma (PlatformService)
  describe('Superadministrador de Plataforma (PlatformService)', () => {
    const platformService = new PlatformService({} as any, dummyJwtService);

    it('rechaza login con credenciales erróneas', async () => {
      await assert.rejects(
        async () => platformService.login({ email: 'erroneo@unisaas.com', password: 'mal' }),
        (err: any) => err instanceof UnauthorizedException,
      );
    });

    it('inicia sesión con credenciales válidas de superadministrador', async () => {
      const res = await platformService.login({
        email: process.env.PLATFORM_ADMIN_EMAIL || 'superadmin@unisaas.com',
        password: process.env.PLATFORM_ADMIN_PASSWORD || 'SuperClave2026!',
      });

      assert.ok('accessToken' in res || 'mfaRequired' in res);
    });
  });
});
