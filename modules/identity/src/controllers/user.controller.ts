import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserService } from '../services/user.service.js';
import type { CreateUserDto } from '../dto/auth.dto.js';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({ summary: 'Listar usuarios del inquilino autenticado (con RLS)' })
  async getUsers(@Req() req: any) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.userService.getUsers(tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Registrar un nuevo usuario en el inquilino autenticado' })
  async createUser(@Req() req: any, @Body() dto: CreateUserDto) {
    const userRoles = req.user?.roles || [];
    if (!userRoles.includes('OWNER') && !userRoles.includes('ADMIN') && !userRoles.includes('SUPERADMIN')) {
      throw new ForbiddenException('Acceso denegado: Solo administradores o propietarios pueden crear usuarios');
    }
    const tenantId = req.tenantId || req.user.tenantId;
    return this.userService.createUser(tenantId, dto);
  }
}
