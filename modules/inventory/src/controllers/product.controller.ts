import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProductService } from '../services/product.service.js';
import type {
  CreateProductDto,
  UpdateProductDto,
  SearchProductsQueryDto,
} from '../dto/inventory.dto.js';

@ApiTags('Inventory - Products')
@ApiBearerAuth()
@Controller('inventory/products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @ApiOperation({ summary: 'Listar o buscar productos del catálogo con paginación y filtros' })
  async getProducts(@Req() req: any, @Query() query: SearchProductsQueryDto) {
    const tenantId = req.tenantId || req.user?.tenantId;
    if (query.search || query.categoryId || query.page || query.limit) {
      return this.productService.searchProducts(tenantId, query);
    }
    return this.productService.getProducts(tenantId);
  }

  @Get('barcode/:barcode')
  @ApiOperation({ summary: 'Buscar producto o variante por código de barras para pistola lectora POS' })
  async getProductByBarcode(@Req() req: any, @Param('barcode') barcode: string) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.productService.findByBarcode(tenantId, barcode);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar detalles de un producto por ID con existencias por bodega' })
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

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar atributos, precios o stock mínimo de un producto' })
  async updateProduct(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.productService.updateProduct(tenantId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Archivar producto (soft-delete)' })
  async deleteProduct(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.productService.deleteProduct(tenantId, id);
  }
}
