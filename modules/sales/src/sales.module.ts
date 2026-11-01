import { Module } from '@nestjs/common';
import { PrismaClient } from '@unisaas/database';
import { PosShiftService } from './services/pos-shift.service.js';
import { InvoiceService } from './services/invoice.service.js';
import { PosShiftController } from './controllers/pos-shift.controller.js';
import { InvoiceController } from './controllers/invoice.controller.js';

@Module({
  controllers: [PosShiftController, InvoiceController],
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
    PosShiftService,
    InvoiceService,
  ],
  exports: [
    PosShiftService,
    InvoiceService,
    PrismaClient,
  ],
})
export class SalesModule {}

