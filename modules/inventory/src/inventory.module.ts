import { Module } from '@nestjs/common';
import { PrismaClient } from '@unisaas/database';
import { ProductService } from './services/product.service.js';
import { WarehouseService } from './services/warehouse.service.js';
import { StockService } from './services/stock.service.js';
import { ProductController } from './controllers/product.controller.js';
import { WarehouseController } from './controllers/warehouse.controller.js';
import { StockController } from './controllers/stock.controller.js';

@Module({
  controllers: [ProductController, WarehouseController, StockController],
  providers: [
    {
      provide: PrismaClient,
      useFactory: () => {
        return new PrismaClient({
          datasources: {
            db: {
              url: process.env.DATABASE_URL || 'postgresql://app_runtime:postgres@localhost:5432/saas_contable_db?schema=public',
            },
          },
        });
      },
    },
    ProductService,
    WarehouseService,
    StockService,
  ],
  exports: [
    ProductService,
    WarehouseService,
    StockService,
    PrismaClient,
  ],
})
export class InventoryModule {}

