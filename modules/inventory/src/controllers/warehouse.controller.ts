import {
  Controller,
  Get,
  Post,
  Body,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WarehouseService } from '../services/warehouse.service.js';
import type { CreateWarehouseDto } from '../dto/inventory.dto.js';

@ApiTags('Inventory - Warehouses')
@ApiBearerAuth()
@Controller('inventory/warehouses')
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Get()
  @ApiOperation({ summary: 'Listar bodegas o almacenes del inquilino (con RLS)' })
  async getWarehouses(@Req() req: any) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.warehouseService.getWarehouses(tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Crear una nueva bodega o almacén' })
  async createWarehouse(@Req() req: any, @Body() dto: CreateWarehouseDto) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.warehouseService.createWarehouse(tenantId, dto);
  }
}

