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
import type {
  StockAdjustmentDto,
  ReceiveStockDto,
  DispatchStockDto,
  ReverseMovementDto,
  TransferStockDto,
  ReceiveTransferDto,
  CreateStockCountDto,
  ApplyStockCountDto,
} from '../dto/inventory.dto.js';

@ApiTags('Inventory - Stock, Kardex & Movimientos')
@ApiBearerAuth()
@Controller('inventory')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get('stock/balances')
  @ApiOperation({ summary: 'Consultar balances de existencias por bodega (con RLS)' })
  async getBalances(@Req() req: any, @Query('warehouseId') warehouseId?: string) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.stockService.getBalances(tenantId, warehouseId);
  }

  @Get('stock/kardex/:variantId')
  @ApiOperation({ summary: 'Consultar historial de movimientos (Kardex) para una variante o producto' })
  async getKardexEntries(
    @Req() req: any,
    @Param('variantId') variantId: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.stockService.getKardexEntries(tenantId, variantId, warehouseId);
  }

  @Get('stock-alerts')
  @ApiOperation({ summary: 'Consultar alertas de stock mínimo o bajo para reabastecimiento' })
  async getStockAlerts(@Req() req: any, @Query('warehouseId') warehouseId?: string) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.stockService.getStockAlerts(tenantId, warehouseId);
  }

  @Post('stock/adjustments')
  @ApiOperation({ summary: 'Registrar ajuste manual de inventario (Entrada o Salida)' })
  async adjustStock(@Req() req: any, @Body() dto: StockAdjustmentDto) {
    const tenantId = req.tenantId || req.user?.tenantId;
    const userId = req.user?.userId || req.user?.id || 'system';
    return this.stockService.adjustStock(tenantId, userId, dto);
  }

  @Post(['moves/receive', 'stock/receive'])
  @ApiOperation({ summary: 'Registrar recepción física de mercancía (compra o entrada) recalculando CPP' })
  async receiveStock(@Req() req: any, @Body() dto: ReceiveStockDto) {
    const tenantId = req.tenantId || req.user?.tenantId;
    const userId = req.user?.userId || req.user?.id || 'system';
    return this.stockService.receiveStock(tenantId, userId, dto);
  }

  @Post(['moves/dispatch', 'stock/dispatch'])
  @ApiOperation({ summary: 'Registrar despacho de mercancía (venta POS) validando stock y retornando CMV a costo CPP' })
  async dispatchStock(@Req() req: any, @Body() dto: DispatchStockDto) {
    const tenantId = req.tenantId || req.user?.tenantId;
    const userId = req.user?.userId || req.user?.id || 'system';
    return this.stockService.dispatchStock(tenantId, userId, dto);
  }

  @Post(['moves/reverse', 'stock/reverse'])
  @ApiOperation({ summary: 'Reversión compensatoria de un movimiento de inventario sin borrado destructivo' })
  async reverseMovement(@Req() req: any, @Body() dto: ReverseMovementDto) {
    const tenantId = req.tenantId || req.user?.tenantId;
    const userId = req.user?.userId || req.user?.id || 'system';
    return this.stockService.reverseMovement(tenantId, userId, dto);
  }

  @Post('transfers')
  @ApiOperation({ summary: 'Iniciar traslado de mercancía entre bodegas (DIRECT o TWO_PHASE)' })
  async transferStock(@Req() req: any, @Body() dto: TransferStockDto) {
    const tenantId = req.tenantId || req.user?.tenantId;
    const userId = req.user?.userId || req.user?.id || 'system';
    return this.stockService.transferStock(tenantId, userId, dto);
  }

  @Post('transfers/:id/receive')
  @ApiOperation({ summary: 'Recibir traslado en tránsito en bodega destino (Fase 2 de TWO_PHASE)' })
  async receiveTransfer(
    @Req() req: any,
    @Param('id') transferId: string,
    @Body() dto: ReceiveTransferDto,
  ) {
    const tenantId = req.tenantId || req.user?.tenantId;
    const userId = req.user?.userId || req.user?.id || 'system';
    return this.stockService.receiveTransfer(tenantId, userId, transferId, dto);
  }

  @Post('stock-counts')
  @ApiOperation({ summary: 'Abrir sesión de conteo físico / auditoría de inventario' })
  async createStockCount(@Req() req: any, @Body() dto: CreateStockCountDto) {
    const tenantId = req.tenantId || req.user?.tenantId;
    const userId = req.user?.userId || req.user?.id || 'system';
    return this.stockService.createStockCount(tenantId, userId, dto);
  }

  @Post('stock-counts/:id/apply')
  @ApiOperation({ summary: 'Aplicar ajustes por sobrantes y faltantes de un conteo físico completado' })
  async applyStockCount(
    @Req() req: any,
    @Param('id') stockCountId: string,
    @Body() dto: ApplyStockCountDto,
  ) {
    const tenantId = req.tenantId || req.user?.tenantId;
    const userId = req.user?.userId || req.user?.id || 'system';
    return this.stockService.applyStockCount(tenantId, userId, stockCountId, dto);
  }
}
