import {
  Controller,
  Get,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { LedgerReportService } from '../services/ledger-report.service.js';

@ApiTags('Accounting - Reports & Financial Statements')
@ApiBearerAuth()
@Controller('accounting')
export class ReportController {
  constructor(private readonly reportService: LedgerReportService) {}

  @Get('reports/trial-balance')
  @ApiOperation({ summary: 'Generar balance de comprobación (Sumas y Saldos) para el inquilino' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async getTrialBalance(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.reportService.getTrialBalance(tenantId, startDate, endDate);
  }

  @Get('reports/balance-sheet')
  @ApiOperation({ summary: 'Balance General clasificado (Activo = Pasivo + Patrimonio)' })
  @ApiQuery({ name: 'asOfDate', required: false })
  async getBalanceSheet(@Req() req: any, @Query('asOfDate') asOfDate?: string) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.reportService.getBalanceSheet(tenantId, asOfDate);
  }

  @Get('reports/income-statement')
  @ApiOperation({ summary: 'Estado de Resultados (Pérdidas y Ganancias P&G)' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async getIncomeStatement(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.reportService.getIncomeStatement(tenantId, startDate, endDate);
  }

  @Get('reports/ledger/:account_code')
  @ApiOperation({ summary: 'Movimientos auxiliares y saldo acumulado para una cuenta PUC' })
  @ApiParam({ name: 'account_code', example: '110505', description: 'Código PUC de la cuenta' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async getAccountLedger(
    @Req() req: any,
    @Param('account_code') accountCode: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.reportService.getAccountLedger(tenantId, accountCode, startDate, endDate);
  }

  @Get('ledger/:account_code')
  @ApiOperation({ summary: 'Alias para libro auxiliar de una cuenta PUC' })
  async getAccountLedgerAlias(
    @Req() req: any,
    @Param('account_code') accountCode: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.getAccountLedger(req, accountCode, startDate, endDate);
  }
}
