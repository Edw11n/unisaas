import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaClient, withTenantContext } from '@unisaas/database';
import { Money, TaxRate } from '@unisaas/core-domain';
import { randomUUID } from 'node:crypto';
import type {
  CreateProductDto,
  UpdateProductDto,
  SearchProductsQueryDto,
} from '../dto/inventory.dto.js';

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
          inventoryBalances: {
            include: { warehouse: true },
          },
        },
        orderBy: { name: 'asc' },
      });
    });
  }

  async searchProducts(tenantId: string, query: SearchProductsQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const where: any = {
        status: query.status || 'ACTIVE',
      };

      if (query.categoryId) {
        where.categoryId = query.categoryId;
      }

      if (query.search) {
        const term = query.search.trim();
        where.OR = [
          { name: { contains: term, mode: 'insensitive' } },
          { sku: { contains: term, mode: 'insensitive' } },
          { barcode: { contains: term, mode: 'insensitive' } },
          {
            barcodes: {
              some: { barcode: { contains: term, mode: 'insensitive' } },
            },
          },
        ];
      }

      const [items, total] = await Promise.all([
        tx.product.findMany({
          where,
          include: {
            category: true,
            unitOfMeasure: true,
            variants: {
              include: { barcodes: true },
            },
            inventoryBalances: {
              include: { warehouse: true },
            },
          },
          skip,
          take: limit,
          orderBy: { name: 'asc' },
        }),
        tx.product.count({ where }),
      ]);

      return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
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
          inventoryBalances: {
            include: { warehouse: true },
          },
        },
      });

      if (!product) {
        throw new NotFoundException(`Producto con ID ${id} no encontrado`);
      }

      return product;
    });
  }

  async findByBarcode(tenantId: string, barcode: string) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      // 1. Buscar en tabla de códigos de barras (variantes o productos)
      const barcodeRecord = await tx.productBarcode.findFirst({
        where: { barcode: barcode.trim(), isActive: true },
        include: {
          product: {
            include: {
              category: true,
              unitOfMeasure: true,
              inventoryBalances: { include: { warehouse: true } },
            },
          },
          variant: {
            include: {
              product: {
                include: {
                  category: true,
                  unitOfMeasure: true,
                  inventoryBalances: { include: { warehouse: true } },
                },
              },
            },
          },
        },
      });

      if (barcodeRecord?.product) {
        return barcodeRecord.product;
      }
      if (barcodeRecord?.variant?.product) {
        return {
          ...barcodeRecord.variant.product,
          selectedVariant: barcodeRecord.variant,
        };
      }

      // 2. Buscar por coincidencia directa en campo barcode de product
      const product = await tx.product.findFirst({
        where: { barcode: barcode.trim(), status: 'ACTIVE' },
        include: {
          category: true,
          unitOfMeasure: true,
          variants: { include: { barcodes: true } },
          inventoryBalances: { include: { warehouse: true } },
        },
      });

      if (!product) {
        throw new NotFoundException(
          `No se encontró ningún producto con el código de barras "${barcode}"`,
        );
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
          barcode: dto.barcode || null,
          status: 'ACTIVE',
          costPrice: cost.toNumber(),
          salePrice: price.toNumber(),
          wholesalePrice: dto.wholesalePrice ? Money.from(dto.wholesalePrice).toNumber() : null,
          taxRate: tax.percentage,
          minStockAlert: dto.minStockAlert !== undefined ? dto.minStockAlert : 5,
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
              barcodes: dto.barcode
                ? {
                    create: {
                      id: randomUUID(),
                      tenantId,
                      barcode: dto.barcode,
                      type: 'EAN13',
                      isPrimary: true,
                    },
                  }
                : undefined,
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

  async updateProduct(tenantId: string, id: string, dto: UpdateProductDto) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const product = await tx.product.findUnique({ where: { id } });
      if (!product) {
        throw new NotFoundException(`Producto con ID ${id} no encontrado`);
      }

      const updateData: any = {};
      if (dto.name !== undefined) updateData.name = dto.name;
      if (dto.description !== undefined) updateData.description = dto.description;
      if (dto.costPrice !== undefined) updateData.costPrice = Money.from(dto.costPrice).toNumber();
      if (dto.sellingPrice !== undefined) updateData.salePrice = Money.from(dto.sellingPrice).toNumber();
      if (dto.wholesalePrice !== undefined) updateData.wholesalePrice = Money.from(dto.wholesalePrice).toNumber();
      if (dto.taxRate !== undefined) updateData.taxRate = TaxRate.from(dto.taxRate).percentage;
      if (dto.minStockAlert !== undefined) updateData.minStockAlert = dto.minStockAlert;
      if (dto.categoryId !== undefined) updateData.categoryId = dto.categoryId;
      if (dto.unitOfMeasureId !== undefined) updateData.unitOfMeasureId = dto.unitOfMeasureId;
      if (dto.status !== undefined) updateData.status = dto.status;

      return tx.product.update({
        where: { id },
        data: updateData,
        include: {
          category: true,
          unitOfMeasure: true,
          variants: true,
        },
      });
    });
  }

  async deleteProduct(tenantId: string, id: string) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const product = await tx.product.findUnique({ where: { id } });
      if (!product) {
        throw new NotFoundException(`Producto con ID ${id} no encontrado`);
      }

      return tx.product.update({
        where: { id },
        data: {
          status: 'ARCHIVED',
          archivedAt: new Date(),
        },
      });
    });
  }
}
