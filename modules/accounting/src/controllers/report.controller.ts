import {
  Controller,
  Get,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LedgerReportService } from '../services/ledger-report.service.js';

@ApiTags('Accounting - Reports')
@ApiBearerAuth()
@Controller('accounting/reports')
export class ReportController {
  constructor(private readonly reportService: LedgerReportService) {}

  @Get('trial-balance')
  @ApiOperation({ summary: 'Generar balance de comprobación (Sumas y Saldos) para el inquilino' })
  async getTrialBalance(@Req() req: any) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.reportService.getTrialBalance(tenantId);
  }
}

