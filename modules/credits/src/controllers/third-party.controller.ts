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
import { ThirdPartyService } from '../services/third-party.service.js';
import type { CreateThirdPartyDto } from '../dto/credits.dto.js';

@ApiTags('Credits - Third Parties')
@ApiBearerAuth()
@Controller('credits/third-parties')
export class ThirdPartyController {
  constructor(private readonly thirdPartyService: ThirdPartyService) {}

  @Get()
  @ApiOperation({ summary: 'Listar terceros (clientes y proveedores) del inquilino (con RLS)' })
  async getThirdParties(@Req() req: any, @Query('partyType') partyType?: any) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.thirdPartyService.getThirdParties(tenantId, partyType);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar detalles e historial reciente de un tercero' })
  async getThirdPartyById(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.thirdPartyService.getThirdPartyById(tenantId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Registrar un nuevo tercero (Cliente, Proveedor o Ambos)' })
  async createThirdParty(@Req() req: any, @Body() dto: CreateThirdPartyDto) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.thirdPartyService.createThirdParty(tenantId, dto);
  }
}

