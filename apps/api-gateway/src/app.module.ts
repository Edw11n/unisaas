import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { IdentityModule } from '@unisaas/identity';
import { InventoryModule } from '@unisaas/inventory';
import { SalesModule } from '@unisaas/sales';
import { AccountingModule } from '@unisaas/accounting';
import { CreditsModule } from '@unisaas/credits';
import { CheckoutModule } from './checkout/checkout.module.js';
import { HealthController } from './controllers/health.controller.js';
import { GlobalHttpExceptionFilter } from './common/filters/global-exception.filter.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';

@Module({
  imports: [
    IdentityModule,
    InventoryModule,
    SalesModule,
    AccountingModule,
    CreditsModule,
    CheckoutModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalHttpExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}

