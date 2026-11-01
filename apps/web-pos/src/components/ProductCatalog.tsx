'use client';

import React, { useState, useMemo } from 'react';
import { Search, Plus, Package } from 'lucide-react';
import { usePosCartStore } from '@/store/pos-cart.store';
import { formatCOP } from '@/lib/utils';
import { playBeepSound } from '@/lib/sound-effects';

export interface ProductCatalogItem {
  id: string;
  sku: string;
  name: string;
  category?: { name: string };
  variants: Array<{
    id: string;
    sku: string;
    name: string;
    salePrice: number;
    costPrice?: number;
    taxRate: number;
    unitOfMeasure?: { symbol: string };
  }>;
}

interface ProductCatalogProps {
  products: ProductCatalogItem[];
  defaultWarehouseId: string;
}

export function ProductCatalog({ products, defaultWarehouseId }: ProductCatalogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('TODAS');
  const addItem = usePosCartStore((state) => state.addItem);

  // Extraer categorías únicas
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category?.name) set.add(p.category.name);
    });
    return ['TODAS', ...Array.from(set)];
  }, [products]);

  // Filtrado reactivo en memoria
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.variants.some((v) => v.sku.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesCat =
        selectedCategory === 'TODAS' || p.category?.name === selectedCategory;

      return matchesSearch && matchesCat;
    });
  }, [products, searchTerm, selectedCategory]);

  const handleSelectProduct = (prod: ProductCatalogItem) => {
    const variant = prod.variants[0];
    if (!variant) return;

    try {
      playBeepSound();
    } catch {}

    addItem({
      productId: prod.id,
      variantId: variant.id,
      warehouseId: defaultWarehouseId,
      productName: variant.name || prod.name,
      productSku: variant.sku || prod.sku,
      price: Number(variant.salePrice),
      taxRate: Number(variant.taxRate) > 1 ? Number(variant.taxRate) : Number(variant.taxRate) * 100,
    });
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Barra de Búsqueda y Filtros */}
      <div className="p-4 border-b border-slate-100 space-y-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre de producto o código SKU / barras..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all"
          />
        </div>

        {/* Categorías */}
        {categories.length > 1 && (
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? 'bg-brand-primary text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid de Productos */}
      <div className="flex-1 p-4 overflow-y-auto">
        {filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <Package className="w-12 h-12 mb-2 stroke-1 text-slate-300" />
            <p className="text-sm">No se encontraron productos disponibles</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filteredProducts.map((prod) => {
              const variant = prod.variants[0];
              const price = variant ? Number(variant.salePrice) : 0;

              return (
                <button
                  key={prod.id}
                  onClick={() => handleSelectProduct(prod)}
                  className="flex flex-col justify-between p-3.5 bg-slate-50 hover:bg-brand-primary-light/50 border border-slate-200 hover:border-brand-primary/40 rounded-xl text-left transition-all group relative"
                >
                  <div>
                    <span className="text-[10px] font-mono font-medium text-slate-400 uppercase">
                      {prod.sku}
                    </span>
                    <h3 className="text-sm font-semibold text-slate-800 line-clamp-2 mt-0.5 group-hover:text-brand-primary transition-colors">
                      {prod.name}
                    </h3>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900">
                      {formatCOP(price)}
                    </span>
                    <div className="w-6 h-6 rounded-full bg-brand-primary/10 text-brand-primary group-hover:bg-brand-primary group-hover:text-white flex items-center justify-center transition-colors">
                      <Plus className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

