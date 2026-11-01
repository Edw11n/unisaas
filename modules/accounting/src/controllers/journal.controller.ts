import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JournalService } from '../services/journal.service.js';
import type {
  CreateJournalEntryDto,
  ManualEntryDto,
  ReversalEntryDto,
  SalesPosCausationDto,
} from '../dto/accounting.dto.js';

@ApiTags('Accounting - Journals (Libro Diario)')
@ApiBearerAuth()
@Controller('accounting/journals')
export class JournalController {
  constructor(private readonly journalService: JournalService) {}

  @Get()
  @ApiOperation({ summary: 'Listar asientos contables registrados con filtros de fecha y sucursal' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'sourceDocumentType', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async getJournalEntries(
    @Req() req: any,
    @Query('branchId') branchId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('sourceDocumentType') sourceDocumentType?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.journalService.getJournalEntries(tenantId, {
      branchId,
      startDate,
      endDate,
      sourceDocumentType,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar detalles y líneas de un asiento contable' })
  async getJournalEntryById(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.journalService.getJournalEntryById(tenantId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Registrar un nuevo asiento contable por partida doble' })
  @HttpCode(HttpStatus.CREATED)
  async createJournalEntry(@Req() req: any, @Body() dto: CreateJournalEntryDto) {
    const tenantId = req.tenantId || req.user?.tenantId;
    const userId = req.user?.userId || req.user?.id || 'system';
    return this.journalService.createJournalEntry(tenantId, userId, dto);
  }

  @Post('manual')
  @ApiOperation({ summary: 'Asiento contable manual de ajuste con partida doble obligatoria' })
  @HttpCode(HttpStatus.CREATED)
  async createManualEntry(@Req() req: any, @Body() dto: ManualEntryDto) {
    const tenantId = req.tenantId || req.user?.tenantId;
    const userId = req.user?.userId || req.user?.id || 'system';
    return this.journalService.createManualEntry(tenantId, userId, dto);
  }

  @Post('reversal')
  @ApiOperation({ summary: 'Generar contra-asiento reversible exacto invirtiendo débitos y créditos' })
  @HttpCode(HttpStatus.OK)
  async createReversal(@Req() req: any, @Body() dto: ReversalEntryDto) {
    const tenantId = req.tenantId || req.user?.tenantId;
    const userId = req.user?.userId || req.user?.id || 'system';
    return this.journalService.reverseJournalEntry(
      tenantId,
      {
        entryId: dto.originalEntryId,
        entryNumber: dto.originalEntryNumber,
      },
      userId,
      dto.reason || 'Anulación de asiento',
    );
  }

  @Post(':id/reverse')
  @ApiOperation({ summary: 'Alias para reversar un asiento contable por ID' })
  @HttpCode(HttpStatus.OK)
  async reverseJournalEntryById(
    @Req() req: any,
    @Param('id') id: string,
    @Body('reason') reason: string,
  ) {
    const tenantId = req.tenantId || req.user?.tenantId;
    const userId = req.user?.userId || req.user?.id || 'system';
    return this.journalService.reverseJournalEntry(
      tenantId,
      { entryId: id },
      userId,
      reason || 'Anulación de asiento',
    );
  }

  @Post('sales-pos')
  @ApiOperation({
    summary: 'Causación automática de factura POS en partida doble NIIF (Caja/Bancos, Ventas, IVA, Costo e Inventario)',
  })
  @HttpCode(HttpStatus.OK)
  async causeSalesPos(@Req() req: any, @Body() dto: SalesPosCausationDto) {
    const tenantId = req.tenantId || req.user?.tenantId;
    const userId = req.user?.userId || req.user?.id || 'system';
    return this.journalService.causeSalesPos(tenantId, userId, dto);
  }
}
