import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PlatformService } from '../services/platform.service.js';
import { Public, Roles } from '../decorators/auth.decorators.js';
import type {
  PlatformLoginDto,
  PlatformMfaVerifyDto,
  ResetPasswordDto,
} from '../dto/identity-extended.dto.js';

@ApiTags('Platform - Superadministrador Global')
@Controller('platform')
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @Public()
  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login de plataforma para Superadministrador global' })
  async login(@Body() dto: PlatformLoginDto) {
    return this.platformService.login(dto);
  }

  @Public()
  @Post('auth/mfa/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verificación de segundo factor (TOTP) para Superadministrador' })
  async verifyMfa(@Body() dto: PlatformMfaVerifyDto) {
    return this.platformService.verifyMfa(dto);
  }

  @ApiBearerAuth()
  @Get('tenants/pending')
  @Roles('SUPERADMIN')
  @ApiOperation({ summary: 'Listar empresas pendientes de aprobación' })
  async getPendingTenants() {
    return this.platformService.getPendingTenants();
  }

  @ApiBearerAuth()
  @Post('tenants/:id/approve')
  @Roles('SUPERADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Aprobar y activar formalmente un comercio' })
  async approveTenant(@Param('id') id: string) {
    return this.platformService.approveTenant(id);
  }

  @ApiBearerAuth()
  @Post('tenants/:id/reset-owner-password')
  @Roles('SUPERADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restablecer contraseña de emergencia para el OWNER de un comercio' })
  async resetOwnerPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto) {
    return this.platformService.resetOwnerPassword(id, dto);
  }

  @ApiBearerAuth()
  @Get('audit')
  @Roles('SUPERADMIN')
  @ApiOperation({ summary: 'Listar eventos de auditoría global de la plataforma' })
  async getPlatformAuditLogs() {
    return this.platformService.getPlatformAuditLogs();
  }
}

