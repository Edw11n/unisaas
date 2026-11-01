import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TenantService } from '../services/tenant.service.js';
import type { CreateTenantDto, CreateBranchDto } from '../dto/auth.dto.js';

@ApiTags('Tenants')
@ApiBearerAuth()
@Controller('tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Consultar detalles de una empresa/inquilino' })
  async getTenant(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenantId || req.user?.tenantId;
    if (id !== tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      throw new ForbiddenException('Acceso denegado: No tiene permisos para consultar información de otro inquilino');
    }
    return this.tenantService.getTenant(tenantId);
  }

  @Get(':id/branches')
  @ApiOperation({ summary: 'Listar sucursales de la empresa (con RLS)' })
  async getBranches(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenantId || req.user?.tenantId;
    if (id !== tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      throw new ForbiddenException('Acceso denegado: No tiene permisos para consultar sucursales de otro inquilino');
    }
    return this.tenantService.getBranches(tenantId);
  }

  @Post(':id/branches')
  @ApiOperation({ summary: 'Crear nueva sucursal para la empresa' })
  async createBranch(@Req() req: any, @Param('id') id: string, @Body() dto: CreateBranchDto) {
    const tenantId = req.tenantId || req.user?.tenantId;
    if (id !== tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
      throw new ForbiddenException('Acceso denegado: No tiene permisos para crear sucursales en otro inquilino');
    }
    return this.tenantService.createBranch(tenantId, dto);
  }

  @Post()
  @ApiOperation({ summary: 'Registrar nueva empresa en la plataforma (Onboarding)' })
  async createTenant(@Body() dto: CreateTenantDto) {
    return this.tenantService.createTenant(dto);
  }
}
