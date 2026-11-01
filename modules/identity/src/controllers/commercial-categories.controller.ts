import { Controller, Get, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { CommercialCategoriesService } from '../services/commercial-categories.service.js';
import type { CommercialCategory } from '../domain/commercial-category.js';
import { Public } from '../decorators/auth.decorators.js';

@ApiTags('Commercial Categories - Rubros Comerciales')
@Controller('commercial-categories')
export class CommercialCategoriesController {
  constructor(private readonly categoriesService: CommercialCategoriesService) {}

  @Public()
  @ApiOperation({
    summary: 'Listar categorías comerciales y capacidades sugeridas',
    description:
      'Devuelve el catálogo de los rubros comerciales principales con sus familias y presets de capacidades operativas.',
  })
  @ApiResponse({ status: 200, description: 'Catálogo de categorías comerciales' })
  @Get()
  @HttpCode(HttpStatus.OK)
  findAll(): CommercialCategory[] {
    return this.categoriesService.findAll();
  }

  @Public()
  @ApiOperation({
    summary: 'Consultar categoría comercial por código',
    description: 'Devuelve la definición de la categoría y sus capacidades activadas.',
  })
  @ApiParam({ name: 'code', example: 'RESTAURANTE', description: 'Código único de la categoría' })
  @ApiResponse({ status: 200, description: 'Detalle de la categoría comercial' })
  @Get(':code')
  @HttpCode(HttpStatus.OK)
  findByCode(@Param('code') code: string): CommercialCategory {
    return this.categoriesService.findByCode(code);
  }
}
