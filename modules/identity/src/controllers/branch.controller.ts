import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  Param,
  Patch,
  Delete,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { BranchService } from '../services/branch.service.js';
import { Roles } from '../decorators/auth.decorators.js';
import type { CreateBranchDto } from '../dto/auth.dto.js';
import type { UpdateBranchDto } from '../dto/identity-extended.dto.js';

@ApiTags('Branches - Sucursales')
@ApiBearerAuth()
@Controller('branches')
export class BranchController {
  constructor(private readonly branchService: BranchService) {}

  @ApiOperation({ summary: 'Listar sucursales del inquilino autenticado (RLS)' })
  @Get()
  @Roles('OWNER', 'ADMIN', 'ACCOUNTANT', 'WAREHOUSE_MANAGER', 'CASHIER')
  async getBranches(@Req() req: any) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.branchService.findAll(tenantId);
  }

  @ApiOperation({ summary: 'Obtener sucursal por ID o Código' })
  @ApiParam({ name: 'identifier', example: 'BR01', description: 'UUID o código de la sucursal' })
  @Get(':identifier')
  @Roles('OWNER', 'ADMIN', 'ACCOUNTANT', 'WAREHOUSE_MANAGER', 'CASHIER')
  async getBranchById(@Param('identifier') identifier: string, @Req() req: any) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.branchService.findByIdentifier(tenantId, identifier);
  }

  @ApiOperation({ summary: 'Crear sucursal para el inquilino' })
  @Post()
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async createBranch(@Body() createBranchDto: CreateBranchDto, @Req() req: any) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.branchService.create(tenantId, createBranchDto);
  }

  @ApiOperation({ summary: 'Actualizar sucursal por ID o Código' })
  @ApiParam({ name: 'identifier', example: 'BR01', description: 'UUID o código de la sucursal a actualizar' })
  @Patch(':identifier')
  @Roles('OWNER', 'ADMIN')
  async updateBranch(
    @Param('identifier') identifier: string,
    @Body() updateBranchDto: UpdateBranchDto,
    @Req() req: any,
  ) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.branchService.update(tenantId, identifier, updateBranchDto);
  }

  @ApiOperation({ summary: 'Eliminar sucursal (Soft Delete)' })
  @ApiParam({ name: 'identifier', example: 'BR01', description: 'UUID o código de la sucursal a eliminar' })
  @Delete(':identifier')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteBranch(@Param('identifier') identifier: string, @Req() req: any) {
    const tenantId = req.tenantId || req.user?.tenantId;
    await this.branchService.softDelete(tenantId, identifier);
  }
}
