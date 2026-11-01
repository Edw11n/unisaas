import {
  Controller,
  Post,
  Body,
  Headers,
  Res,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentTenant } from '../../common/decorators/tenant.decorator.js';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CheckoutCoordinatorService } from '../services/checkout-coordinator.service.js';
import type { CheckoutDto } from '../dto/checkout.dto.js';

@Controller('pos/checkout')
export class CheckoutController {
  constructor(private readonly checkoutCoordinator: CheckoutCoordinatorService) {}

  @Post()
  @Roles('CASHIER', 'ADMIN', 'TENANT_ADMIN', 'SUPER_ADMIN')
  async checkout(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') headerKey: string,
    @Headers('x-idempotency-key') altHeaderKey: string,
    @Body() dto: CheckoutDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const idempotencyKey = (headerKey || altHeaderKey || '').trim();

    if (!idempotencyKey) {
      throw new BadRequestException('El encabezado "Idempotency-Key" es requerido para operaciones de checkout');
    }

    const userId = user?.id || 'system';

    const result = await this.checkoutCoordinator.executeCheckout(
      tenantId,
      userId,
      idempotencyKey,
      dto,
    );

    if (result.isReplay) {
      res.setHeader('X-Idempotent-Replay', 'true');
      res.status(HttpStatus.OK);
    } else {
      res.status(HttpStatus.CREATED);
    }

    return result;
  }
}
