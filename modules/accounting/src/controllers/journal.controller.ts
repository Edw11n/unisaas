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
import { JournalService } from '../services/journal.service.js';
import type { CreateJournalEntryDto } from '../dto/accounting.dto.js';

@ApiTags('Accounting - Journals')
@ApiBearerAuth()
@Controller('accounting/journals')
export class JournalController {
  constructor(private readonly journalService: JournalService) {}

  @Get()
  @ApiOperation({ summary: 'Listar asientos contables registrados (con RLS)' })
  async getJournalEntries(@Req() req: any, @Query('branchId') branchId?: string) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.journalService.getJournalEntries(tenantId, branchId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar detalles y líneas de un asiento contable' })
  async getJournalEntryById(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.journalService.getJournalEntryById(tenantId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Registrar un nuevo asiento contable por partida doble' })
  async createJournalEntry(@Req() req: any, @Body() dto: CreateJournalEntryDto) {
    const tenantId = req.tenantId || req.user?.tenantId;
    const userId = req.user?.userId || req.user?.id || 'system';
    return this.journalService.createJournalEntry(tenantId, userId, dto);
  }

  @Post(':id/reverse')
  @ApiOperation({ summary: 'Reversar un asiento contable existente generando contra-asiento' })
  async reverseJournalEntry(
    @Req() req: any,
    @Param('id') id: string,
    @Body('reason') reason: string,
  ) {
    const tenantId = req.tenantId || req.user?.tenantId;
    const userId = req.user?.userId || req.user?.id || 'system';
    return this.journalService.reverseJournalEntry(tenantId, id, userId, reason || 'Anulación de asiento');
  }
}

