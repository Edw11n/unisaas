import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StockService } from '../services/stock.service.js';
import type { StockAdjustmentDto } from '../dto/inventory.dto.js';

@ApiTags('Inventory - Stock & Kardex')
@ApiBearerAuth()
@Controller('inventory/stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get('balances')
  @ApiOperation({ summary: 'Consultar balances de existencias por bodega (con RLS)' })
  async getBalances(@Req() req: any, @Query('warehouseId') warehouseId?: string) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.stockService.getBalances(tenantId, warehouseId);
  }

  @Get('kardex/:variantId')
  @ApiOperation({ summary: 'Consultar historial de movimientos (Kardex) para una variante' })
  async getKardexEntries(@Req() req: any, @Param('variantId') variantId: string) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.stockService.getKardexEntries(tenantId, variantId);
  }

  @Post('adjustments')
  @ApiOperation({ summary: 'Registrar ajuste manual de inventario (Entrada o Salida)' })
  async adjustStock(@Req() req: any, @Body() dto: StockAdjustmentDto) {
    const tenantId = req.tenantId || req.user?.tenantId;
    const userId = req.user?.userId || req.user?.id || 'system';
    return this.stockService.adjustStock(tenantId, userId, dto);
  }
}

