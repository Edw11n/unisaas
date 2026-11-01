import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProductService } from '../services/product.service.js';
import type { CreateProductDto } from '../dto/inventory.dto.js';

@ApiTags('Inventory - Products')
@ApiBearerAuth()
@Controller('inventory/products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @ApiOperation({ summary: 'Listar productos del catálogo del inquilino (con RLS)' })
  async getProducts(@Req() req: any) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.productService.getProducts(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar detalles de un producto por ID' })
  async getProductById(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.productService.getProductById(tenantId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo producto con su variante por defecto y código de barras' })
  async createProduct(@Req() req: any, @Body() dto: CreateProductDto) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.productService.createProduct(tenantId, dto);
  }
}

