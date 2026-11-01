import { Module } from '@nestjs/common';
import { PrismaClient } from '@unisaas/database';
import { ThirdPartyService } from './services/third-party.service.js';
import { PurchaseService } from './services/purchase.service.js';
import { CreditService } from './services/credit.service.js';
import { ThirdPartyController } from './controllers/third-party.controller.js';
import { PurchaseController } from './controllers/purchase.controller.js';
import { CreditController } from './controllers/credit.controller.js';

@Module({
  controllers: [ThirdPartyController, PurchaseController, CreditController],
  providers: [
    {
      provide: PrismaClient,
      useFactory: () => {
        return new PrismaClient({
          datasources: {
            db: {
              url: process.env.DATABASE_URL || 'postgresql://app_runtime:postgres@localhost:5432/saas_contable_db?schema=public',
            },
          },
        });
      },
    },
    ThirdPartyService,
    PurchaseService,
    CreditService,
  ],
  exports: [
    ThirdPartyService,
    PurchaseService,
    CreditService,
    PrismaClient,
  ],
})
export class CreditsModule {}

