import { Module } from '@nestjs/common';
import { PrismaClient } from '@unisaas/database';
import { RedisClientService, IdempotencyLockService } from '@unisaas/redis-client';
import { IdempotencyService } from './services/idempotency.service.js';
import { OutboxProcessorService } from './services/outbox-processor.service.js';
import { CheckoutCoordinatorService } from './services/checkout-coordinator.service.js';
import { CheckoutController } from './controllers/checkout.controller.js';

@Module({
  controllers: [CheckoutController],
  providers: [
    {
      provide: PrismaClient,
      useFactory: () => {
        return new PrismaClient({
          datasources: {
            db: {
              url: process.env.DATABASE_URL || 'postgresql://app_runtime:postgres@localhost:5432/saas_contable_db?schema=public&connection_limit=50&pool_timeout=20',
            },
          },
        });
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
      provide: IdempotencyLockService,
      useFactory: (redisService: RedisClientService) => new IdempotencyLockService(redisService),
      inject: [RedisClientService],
    },
    IdempotencyService,
    OutboxProcessorService,
    CheckoutCoordinatorService,
  ],
  exports: [
    IdempotencyService,
    OutboxProcessorService,
    CheckoutCoordinatorService,
    PrismaClient,
  ],
})
export class CheckoutModule {}

