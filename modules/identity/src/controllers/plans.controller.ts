import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PlansService } from '../services/plans.service.js';
import { Public } from '../decorators/auth.decorators.js';
import type { AssignPlanDto } from '../dto/identity-extended.dto.js';

@ApiTags('Plans & Subscriptions - Planes y Cuotas SaaS')
@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Public()
  @ApiOperation({
    summary: 'Listar planes SaaS disponibles',
    description: 'Devuelve los planes comerciales y sus límites operativos.',
  })
  @ApiResponse({ status: 200, description: 'Listado de planes' })
  @Get()
  @HttpCode(HttpStatus.OK)
  findAll() {
    return this.plansService.getAvailablePlans();
  }

  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Consultar suscripción y límites del tenant actual',
    description: 'Devuelve el plan activo, cuotas y si el sistema opera en modo piloto permisivo.',
  })
  @Get('my-subscription')
  @HttpCode(HttpStatus.OK)
  getMySubscription(@Req() req: any) {
    const tenantId = req.tenantId || req.user?.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('Identidad de inquilino ausente en la sesión autenticada');
    }
    return this.plansService.getTenantSubscription(tenantId);
  }

  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Cambiar de plan (Permisivo en fase piloto)',
    description: 'Permite actualizar el plan asociado al comercio.',
  })
  @Post('change-plan')
  @HttpCode(HttpStatus.OK)
  changePlan(@Req() req: any, @Body() body: AssignPlanDto) {
    const tenantId = req.tenantId || req.user?.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('Identidad de inquilino ausente en la sesión autenticada');
    }
    return this.plansService.assignPlanToTenant(tenantId, body.planCode);
  }
}
