import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CategoryService } from '../services/category.service.js';
import type { CreateCategoryDto, UpdateCategoryDto } from '../dto/inventory.dto.js';

@ApiTags('Inventory - Categorías de Productos')
@ApiBearerAuth()
@Controller('inventory/categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @ApiOperation({ summary: 'Listar categorías de productos con jerarquía de árbol' })
  async getCategories(@Req() req: any) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.categoryService.getCategories(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de una categoría' })
  async getCategoryById(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.categoryService.getCategoryById(tenantId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear nueva categoría de productos' })
  async createCategory(@Req() req: any, @Body() dto: CreateCategoryDto) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.categoryService.createCategory(tenantId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar categoría existente' })
  async updateCategory(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.categoryService.updateCategory(tenantId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Desactivar o archivar categoría de productos' })
  async deleteCategory(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.categoryService.deleteCategory(tenantId, id);
  }
}
