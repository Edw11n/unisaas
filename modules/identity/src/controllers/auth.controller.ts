import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from '../services/auth.service.js';
import type { LoginDto, RefreshTokenDto } from '../dto/auth.dto.js';
import type { RegisterDto, ActivateAccountDto } from '../dto/identity-extended.dto.js';
import { Public } from '../decorators/auth.decorators.js';

@ApiTags('Auth - Autenticación y Sesiones')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar nuevo comercio y propietario',
    description:
      'Crea en una única transacción atómica la empresa (tenant), la sucursal principal, la bodega de inventario y la cuenta de usuario OWNER, retornando de inmediato tokens de sesión válidos.',
  })
  @ApiResponse({ status: 201, description: 'Comercio registrado exitosamente y sesión iniciada' })
  @ApiResponse({ status: 409, description: 'El correo electrónico o NIT ya existe en el sistema' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

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
  @Post('activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Activar cuenta de colaborador',
    description:
      'Endpoint público. Valida el código temporal de 6 dígitos y establece la nueva contraseña. Rate limit: 5 intentos cada 15 minutos.',
  })
  async activate(@Body() dto: ActivateAccountDto, @Req() req: any) {
    const clientIp =
      (req.headers?.['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
      req.ip ||
      'unknown';

    return this.authService.activateAccount({
      ...dto,
      clientIp,
    });
  }

  @Public()
  @Post('activate-account')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Alias para activar cuenta de colaborador' })
  async activateAccount(@Body() dto: ActivateAccountDto, @Req() req: any) {
    return this.activate(dto, req);
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

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener perfil del usuario autenticado' })
  async getMe(@Req() req: any) {
    const user = req.user;
    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        roles: user.roles,
        tenantId: user.tenantId,
        branchId: user.branchId,
      },
    };
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
