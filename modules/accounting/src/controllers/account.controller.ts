import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AccountService } from '../services/account.service.js';
import type { CreateAccountDto } from '../dto/accounting.dto.js';

@ApiTags('Accounting - PUC Accounts')
@ApiBearerAuth()
@Controller('accounting/accounts')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get()
  @ApiOperation({ summary: 'Consultar el catálogo de cuentas PUC del inquilino (con RLS)' })
  async getAccounts(@Req() req: any) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.accountService.getAccounts(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar una cuenta PUC por ID' })
  async getAccountById(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.accountService.getAccountById(tenantId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear una nueva cuenta PUC en el plan contable' })
  async createAccount(@Req() req: any, @Body() dto: CreateAccountDto) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.accountService.createAccount(tenantId, dto);
  }
}

