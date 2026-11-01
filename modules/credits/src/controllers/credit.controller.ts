import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CreditService } from '../services/credit.service.js';
import type { CreditTransactionDto } from '../dto/credits.dto.js';

@ApiTags('Credits - Transactions & Debt')
@ApiBearerAuth()
@Controller('credits/transactions')
export class CreditController {
  constructor(private readonly creditService: CreditService) {}

  @Get(':thirdPartyId')
  @ApiOperation({ summary: 'Consultar estado de cuenta e historial de créditos/abonos de un tercero' })
  async getCreditHistory(@Req() req: any, @Param('thirdPartyId') thirdPartyId: string) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.creditService.getCreditHistory(tenantId, thirdPartyId);
  }

  @Post()
  @ApiOperation({ summary: 'Registrar cargo por venta a crédito o abono a cartera' })
  async registerTransaction(@Req() req: any, @Body() dto: CreditTransactionDto) {
    const tenantId = req.tenantId || req.user?.tenantId;
    const userId = req.user?.userId || req.user?.id || 'system';
    return this.creditService.registerTransaction(tenantId, userId, dto);
  }
}

