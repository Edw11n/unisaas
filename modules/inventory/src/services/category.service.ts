import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaClient, withTenantContext } from '@unisaas/database';
import { randomUUID } from 'node:crypto';
import type { CreateCategoryDto, UpdateCategoryDto } from '../dto/inventory.dto.js';

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaClient) {}

  async getCategories(tenantId: string) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      return tx.productCategory.findMany({
        where: { isActive: true },
        include: {
          parent: true,
          children: true,
          _count: { select: { products: true } },
        },
        orderBy: { name: 'asc' },
      });
    });
  }

  async getCategoryById(tenantId: string, id: string) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const category = await tx.productCategory.findUnique({
        where: { id },
        include: { parent: true, children: true, products: true },
      });

      if (!category) {
        throw new NotFoundException(`Categoría con ID ${id} no encontrada`);
      }

      return category;
    });
  }

  async createCategory(tenantId: string, dto: CreateCategoryDto) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const existing = await tx.productCategory.findFirst({
        where: { name: dto.name },
      });

      if (existing) {
        throw new ConflictException(`Ya existe una categoría con el nombre "${dto.name}"`);
      }

      if (dto.parentId) {
        const parent = await tx.productCategory.findUnique({
          where: { id: dto.parentId },
        });
        if (!parent) {
          throw new NotFoundException(`Categoría padre con ID ${dto.parentId} no encontrada`);
        }
      }

      return tx.productCategory.create({
        data: {
          id: randomUUID(),
          tenantId,
          name: dto.name,
          description: dto.description || null,
          parentId: dto.parentId || null,
          isActive: true,
        },
      });
    });
  }

  async updateCategory(tenantId: string, id: string, dto: UpdateCategoryDto) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const category = await tx.productCategory.findUnique({ where: { id } });
      if (!category) {
        throw new NotFoundException(`Categoría con ID ${id} no encontrada`);
      }

      return tx.productCategory.update({
        where: { id },
        data: {
          ...(dto.name ? { name: dto.name } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
    });
  }

  async deleteCategory(tenantId: string, id: string) {
    return withTenantContext(this.prisma, tenantId, async (tx) => {
      const category = await tx.productCategory.findUnique({
        where: { id },
        include: { _count: { select: { products: true, children: true } } },
      });

      if (!category) {
        throw new NotFoundException(`Categoría con ID ${id} no encontrada`);
      }

      if (category._count.products > 0) {
        throw new ConflictException('No se puede eliminar una categoría que contiene productos asociados');
      }

      if (category._count.children > 0) {
        throw new ConflictException('No se puede eliminar una categoría que contiene subcategorías asociadas');
      }

      return tx.productCategory.update({
        where: { id },
        data: { isActive: false },
      });
    });
  }
}

