import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  SetMetadata,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from '../services/auth.service.js';
import type { LoginDto, RefreshTokenDto } from '../dto/auth.dto.js';

const Public = () => SetMetadata('isPublic', true);

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión y obtener tokens JWT con sesión en Redis' })
  @ApiResponse({ status: 200, description: 'Autenticación exitosa' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renovar access token mediante refresh token' })
  @ApiResponse({ status: 200, description: 'Token renovado exitosamente' })
  @ApiResponse({ status: 401, description: 'Refresh token inválido o revocado' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cerrar sesión activa y revocar token en Redis' })
  async logout(@Req() req: any) {
    const user = req.user;
    await this.authService.logout(user.tenantId, user.id, user.jti);
    return { success: true, message: 'Sesión cerrada correctamente' };
  }

  @Get('sessions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar sesiones activas del usuario' })
  async getSessions(@Req() req: any) {
    const user = req.user;
    return this.authService.getUserSessions(user.tenantId, user.id);
  }

  @Delete('sessions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revocar masivamente todas las sesiones activas del usuario' })
  async revokeAllSessions(@Req() req: any) {
    const user = req.user;
    const count = await this.authService.revokeAllUserSessions(user.tenantId, user.id);
    return { success: true, revokedCount: count };
  }
}

