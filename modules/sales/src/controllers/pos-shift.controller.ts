import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PosShiftService } from '../services/pos-shift.service.js';
import type { OpenShiftDto, CloseShiftDto } from '../dto/sales.dto.js';

@ApiTags('Sales - POS Shifts')
@ApiBearerAuth()
@Controller('sales/shifts')
export class PosShiftController {
  constructor(private readonly shiftService: PosShiftService) {}

  @Get()
  @ApiOperation({ summary: 'Listar turnos de caja de la sucursal (con RLS)' })
  async getShifts(@Req() req: any, @Query('branchId') branchId?: string) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.shiftService.getShifts(tenantId, branchId);
  }

  @Get('current')
  @ApiOperation({ summary: 'Consultar turno activo del cajero en la sucursal' })
  async getCurrentShift(
    @Req() req: any,
    @Query('branchId') branchId: string,
  ) {
    const tenantId = req.tenantId || req.user?.tenantId;
    const cashierId = req.user?.userId || req.user?.id;
    return this.shiftService.getCurrentShift(tenantId, branchId, cashierId);
  }

  @Post('open')
  @ApiOperation({ summary: 'Aperturar un nuevo turno de caja POS' })
  async openShift(@Req() req: any, @Body() dto: OpenShiftDto) {
    const tenantId = req.tenantId || req.user?.tenantId;
    const cashierId = req.user?.userId || req.user?.id;
    return this.shiftService.openShift(tenantId, cashierId, dto);
  }

  @Post(':id/close')
  @ApiOperation({ summary: 'Cerrar y cuadrar un turno de caja POS' })
  async closeShift(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: CloseShiftDto,
  ) {
    const tenantId = req.tenantId || req.user?.tenantId;
    const closedById = req.user?.userId || req.user?.id;
    return this.shiftService.closeShift(tenantId, id, closedById, dto);
  }
}

