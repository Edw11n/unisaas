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
import { InvoiceService } from '../services/invoice.service.js';
import type { CreateInvoiceDto, VoidInvoiceDto } from '../dto/sales.dto.js';

@ApiTags('Sales - Invoices')
@ApiBearerAuth()
@Controller('sales/invoices')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Get()
  @ApiOperation({ summary: 'Listar facturas emitidas por la empresa (con RLS)' })
  async getInvoices(@Req() req: any, @Query('branchId') branchId?: string) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.invoiceService.getInvoices(tenantId, branchId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar detalles completos de una factura por ID' })
  async getInvoiceById(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.invoiceService.getInvoiceById(tenantId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Emitir una nueva factura de venta (POS o Crédito)' })
  async createInvoice(@Req() req: any, @Body() dto: CreateInvoiceDto) {
    const tenantId = req.tenantId || req.user?.tenantId;
    const userId = req.user?.userId || req.user?.id || 'system';
    return this.invoiceService.createInvoice(tenantId, userId, dto);
  }

  @Post(':id/void')
  @ApiOperation({ summary: 'Anular una factura emitida previamente' })
  async voidInvoice(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: VoidInvoiceDto,
  ) {
    const tenantId = req.tenantId || req.user?.tenantId;
    const voidedById = req.user?.userId || req.user?.id || 'system';
    return this.invoiceService.voidInvoice(tenantId, id, voidedById, dto);
  }
}

