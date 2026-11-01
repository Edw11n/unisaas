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
import { PurchaseService } from '../services/purchase.service.js';
import type { CreatePurchaseDto } from '../dto/credits.dto.js';

@ApiTags('Credits - Purchases')
@ApiBearerAuth()
@Controller('credits/purchases')
export class PurchaseController {
  constructor(private readonly purchaseService: PurchaseService) {}

  @Get()
  @ApiOperation({ summary: 'Listar compras a proveedores (con RLS)' })
  async getPurchases(@Req() req: any, @Query('branchId') branchId?: string) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.purchaseService.getPurchases(tenantId, branchId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar detalles completos de una compra por ID' })
  async getPurchaseById(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.purchaseService.getPurchaseById(tenantId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Registrar una compra a proveedor (Contado o Crédito)' })
  async createPurchase(@Req() req: any, @Body() dto: CreatePurchaseDto) {
    const tenantId = req.tenantId || req.user?.tenantId;
    const userId = req.user?.userId || req.user?.id || 'system';
    return this.purchaseService.createPurchase(tenantId, userId, dto);
  }
}

