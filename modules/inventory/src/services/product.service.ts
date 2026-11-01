import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaClient, withTenantContext } from '@unisaas/database';
import { Money, TaxRate } from '@unisaas/core-domain';
import { randomUUID } from 'node:crypto';
import type { CreateProductDto } from '../dto/inventory.dto.js';

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaClient) {}

  async getProducts(tenantId: string) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      return tx.product.findMany({
        where: { status: 'ACTIVE' },
        include: {
          category: true,
          unitOfMeasure: true,
          variants: {
            include: {
              barcodes: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      });
    });
  }

  async getProductById(tenantId: string, id: string) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const product = await tx.product.findUnique({
        where: { id },
        include: {
          category: true,
          unitOfMeasure: true,
          variants: {
            include: {
              barcodes: true,
            },
          },
        },
      });

      if (!product) {
        throw new NotFoundException(`Producto con ID ${id} no encontrado`);
      }

      return product;
    });
  }

  async createProduct(tenantId: string, dto: CreateProductDto) {
    // Validar montos y tasas con los Value Objects puros del Core Domain
    const cost = Money.from(dto.costPrice);
    const price = Money.from(dto.sellingPrice);
    const tax = dto.taxRate !== undefined ? TaxRate.from(dto.taxRate) : TaxRate.zero();

    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const existingSku = await tx.product.findFirst({
        where: { sku: dto.sku },
      });

      if (existingSku) {
        throw new ConflictException(`Ya existe un producto con el SKU "${dto.sku}"`);
      }

      const productId = randomUUID();
      const variantId = randomUUID();

      const created = await tx.product.create({
        data: {
          id: productId,
          tenantId,
          categoryId: dto.categoryId,
          unitOfMeasureId: dto.unitOfMeasureId,
          sku: dto.sku,
          name: dto.name,
          description: dto.description,
          status: 'ACTIVE',
          costPrice: cost.toNumber(),
          salePrice: price.toNumber(),
          taxRate: tax.percentage,
          variants: {
            create: {
              id: variantId,
              tenantId,
              sku: `${dto.sku}-DEF`,
              name: 'Variante Estándar',
              costPrice: cost.toNumber(),
              salePrice: price.toNumber(),
              taxRate: tax.percentage,
              status: 'ACTIVE',
              unitOfMeasureId: dto.unitOfMeasureId,
              isDefault: true,
              barcodes: dto.barcode ? {
                create: {
                  id: randomUUID(),
                  tenantId,
                  barcode: dto.barcode,
                  type: 'EAN13',
                  isPrimary: true,
                },
              } : undefined,
            },
          },
        },
        include: {
          variants: {
            include: { barcodes: true },
          },
        },
      });

      return created;
    });
  }
}
