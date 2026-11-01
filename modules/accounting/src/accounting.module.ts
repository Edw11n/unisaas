import { Module } from '@nestjs/common';
import { PrismaClient } from '@unisaas/database';
import { AccountService } from './services/account.service.js';
import { JournalService } from './services/journal.service.js';
import { LedgerReportService } from './services/ledger-report.service.js';
import { AccountController } from './controllers/account.controller.js';
import { JournalController } from './controllers/journal.controller.js';
import { ReportController } from './controllers/report.controller.js';

@Module({
  controllers: [AccountController, JournalController, ReportController],
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
    AccountService,
    JournalService,
    LedgerReportService,
  ],
  exports: [
    AccountService,
    JournalService,
    LedgerReportService,
    PrismaClient,
  ],
})
export class AccountingModule {}

