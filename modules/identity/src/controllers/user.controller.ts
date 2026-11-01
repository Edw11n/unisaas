import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { UserService } from '../services/user.service.js';
import { Roles } from '../decorators/auth.decorators.js';
import type { CreateUserDto } from '../dto/auth.dto.js';
import type {
  CreateStaffDto,
  UpdateProfileDto,
  UpdateRoleDto,
  UpdateStatusDto,
  ResetPasswordDto,
} from '../dto/identity-extended.dto.js';

@ApiTags('Users - Gestión de Usuarios y RBAC')
@ApiBearerAuth()
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @ApiOperation({ summary: 'Listar usuarios del inquilino autenticado (con RLS)' })
  @ApiQuery({ name: 'branchId', required: false, type: String })
  @ApiQuery({ name: 'role', required: false, type: String })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @Get()
  @Roles('OWNER', 'ADMIN', 'ACCOUNTANT', 'WAREHOUSE_MANAGER', 'CASHIER')
  async getUsers(
    @Req() req: any,
    @Query('branchId') branchId?: string,
    @Query('role') role?: string,
    @Query('isActive') isActive?: string,
  ) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.userService.getUsers(tenantId, {
      branchId,
      role,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  @ApiOperation({ summary: 'Obtener usuario por ID dentro del tenant' })
  @ApiParam({ name: 'id', description: 'UUID del usuario' })
  @Get(':id')
  @Roles('OWNER', 'ADMIN', 'ACCOUNTANT', 'WAREHOUSE_MANAGER', 'CASHIER')
  async getUserById(@Param('id') id: string, @Req() req: any) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.userService.getUserById(tenantId, id);
  }

  @ApiOperation({ summary: 'Registrar un nuevo usuario en el inquilino' })
  @Post()
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async createUser(@Req() req: any, @Body() dto: CreateUserDto) {
    const userRoles = req.user?.roles || (req.user?.role ? [req.user.role] : []);
    if (!userRoles.includes('OWNER') && !userRoles.includes('ADMIN') && !userRoles.includes('SUPERADMIN')) {
      throw new ForbiddenException('Acceso denegado: Solo administradores o propietarios pueden crear usuarios');
    }
    const tenantId = req.tenantId || req.user.tenantId;
    return this.userService.createUser(tenantId, dto);
  }

  @ApiOperation({
    summary: 'Crear colaborador (staff)',
    description:
      'Crea un colaborador con rol específico. Si no se provee contraseña, emite un código temporal de 6 dígitos válido 7 días.',
  })
  @Post('staff')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async createStaff(@Req() req: any, @Body() dto: CreateStaffDto) {
    const tenantId = req.tenantId || req.user.tenantId;
    const requesterRole = req.user?.roles?.[0] || req.user?.role || 'ADMIN';
    return this.userService.createStaff(tenantId, dto, requesterRole);
  }

  @ApiOperation({ summary: 'Actualizar perfil del usuario en sesión' })
  @Patch('me/profile')
  @Roles('OWNER', 'ADMIN', 'ACCOUNTANT', 'WAREHOUSE_MANAGER', 'CASHIER')
  async updateMyProfile(@Req() req: any, @Body() dto: UpdateProfileDto) {
    const tenantId = req.tenantId || req.user.tenantId;
    const userId = req.user.id || req.user.sub;
    return this.userService.updateProfile(tenantId, userId, dto);
  }

  @ApiOperation({ summary: 'Actualizar perfil de un usuario por ID' })
  @ApiParam({ name: 'id', description: 'UUID del usuario a actualizar' })
  @Patch(':id')
  @Roles('OWNER', 'ADMIN')
  async updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateProfileDto,
    @Req() req: any,
  ) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.userService.updateProfile(tenantId, id, dto);
  }

  @ApiOperation({ summary: 'Activar o suspender estado de un usuario' })
  @ApiParam({ name: 'id', description: 'UUID del usuario' })
  @Patch(':id/status')
  @Roles('OWNER', 'ADMIN')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @Req() req: any,
  ) {
    const tenantId = req.tenantId || req.user.tenantId;
    const requestedById = req.user.id || req.user.sub;
    await this.userService.updateStatus(tenantId, id, dto.isActive, requestedById);
    return { success: true, message: 'Estado del usuario actualizado exitosamente' };
  }

  @ApiOperation({ summary: 'Cambiar rol de un usuario' })
  @ApiParam({ name: 'id', description: 'UUID del usuario' })
  @Patch(':id/role')
  @Roles('OWNER', 'ADMIN')
  async updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @Req() req: any,
  ) {
    const tenantId = req.tenantId || req.user.tenantId;
    const requesterRole = req.user?.roles?.[0] || req.user?.role || 'OWNER';
    const requestedById = req.user.id || req.user.sub;
    await this.userService.assignRole(tenantId, id, dto.role, requesterRole, requestedById);
    return { success: true, message: 'Rol del usuario actualizado exitosamente' };
  }

  @ApiOperation({ summary: 'Restablecer contraseña de un usuario' })
  @ApiParam({ name: 'id', description: 'UUID del usuario' })
  @Post(':id/reset-password')
  @Roles('OWNER', 'ADMIN')
  async resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
    @Req() req: any,
  ) {
    const tenantId = req.tenantId || req.user.tenantId;
    const requesterRole = req.user?.roles?.[0] || req.user?.role || 'OWNER';
    return this.userService.resetPassword(tenantId, id, dto.newPassword, requesterRole);
  }

  @ApiOperation({ summary: 'Regenerar código de activación temporal' })
  @ApiParam({ name: 'id', description: 'UUID del usuario' })
  @Post(':id/reset-activation-code')
  @Roles('OWNER', 'ADMIN')
  async resetActivationCode(@Param('id') id: string, @Req() req: any) {
    const tenantId = req.tenantId || req.user.tenantId;
    const requesterRole = req.user?.roles?.[0] || req.user?.role || 'OWNER';
    return this.userService.resetActivationCode(tenantId, id, requesterRole);
  }

  @ApiOperation({ summary: 'Consultar bitácora de auditoría de un usuario' })
  @ApiParam({ name: 'id', description: 'UUID del usuario' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @Get(':id/audit-trail')
  @Roles('OWNER', 'ADMIN')
  async getAuditTrail(
    @Param('id') id: string,
    @Req() req: any,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.userService.getAuditTrail(tenantId, id, page, limit);
  }

  @ApiOperation({ summary: 'Eliminar usuario (Soft Delete)' })
  @ApiParam({ name: 'id', description: 'UUID del usuario a desactivar' })
  @Delete(':id')
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUser(@Param('id') id: string, @Req() req: any) {
    const tenantId = req.tenantId || req.user.tenantId;
    const requestedById = req.user.id || req.user.sub;
    await this.userService.softDelete(tenantId, id, requestedById);
  }
}
