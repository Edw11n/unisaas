import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaClient } from '@unisaas/database';
import {
  RedisClientService,
  SessionCacheService,
  TokenBlacklistService,
} from '@unisaas/redis-client';
import { AuthService } from './services/auth.service.js';
import { TenantService } from './services/tenant.service.js';
import { UserService } from './services/user.service.js';
import { AuthController } from './controllers/auth.controller.js';
import { TenantController } from './controllers/tenant.controller.js';
import { UserController } from './controllers/user.controller.js';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'unisaas-jwt-secret-key-32-chars-min',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [AuthController, TenantController, UserController],
  providers: [
    {
      provide: PrismaClient,
      useFactory: () => {
        const client = new PrismaClient({
          datasources: {
            db: {
              url: process.env.DATABASE_URL || 'postgresql://app_runtime:postgres@localhost:5432/saas_contable_db?schema=public',
            },
          },
        });
        return client;
      },
    },
    {
      provide: RedisClientService,
      useFactory: () => {
        const service = new RedisClientService();
        service.connect().catch(() => {
          // Conexión perezosa tolerante a caídas
        });
        return service;
      },
    },
    {
      provide: SessionCacheService,
      useFactory: (redisService: RedisClientService) => new SessionCacheService(redisService),
      inject: [RedisClientService],
    },
    {
      provide: TokenBlacklistService,
      useFactory: (redisService: RedisClientService) => new TokenBlacklistService(redisService),
      inject: [RedisClientService],
    },
    AuthService,
    TenantService,
    UserService,
  ],
  exports: [
    AuthService,
    TenantService,
    UserService,
    PrismaClient,
    RedisClientService,
    SessionCacheService,
    TokenBlacklistService,
    JwtModule,
  ],
})
export class IdentityModule {}

