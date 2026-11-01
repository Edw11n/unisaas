'use client';

import React, { useEffect, useState } from 'react';
import { HeaderNav } from './HeaderNav';
import { ProductCatalog, ProductCatalogItem } from './ProductCatalog';
import { CartPanel } from './CartPanel';
import { CheckoutModal } from './CheckoutModal';
import { ReceiptModal } from './ReceiptModal';
import { apiClient } from '@/lib/api-client';
import { UserSession } from '@/lib/auth-session';
import { usePosCartStore } from '@/store/pos-cart.store';
import { useRouter } from 'next/navigation';

interface PosTerminalViewProps {
  user: UserSession | null;
  token: string | null;
}

const FALLBACK_PRODUCTS: ProductCatalogItem[] = [
  {
    id: 'f1111111-1111-1111-1111-111111111111',
    sku: 'COL-500-1111',
    name: 'Gaseosa Cola 500ml',
    category: { name: 'Bebidas' },
    variants: [
      {
        id: 'f2222222-1111-1111-1111-111111111111',
        sku: 'COL-500-1111',
        name: 'Gaseosa Cola 500ml',
        salePrice: 3000,
        taxRate: 0.19,
        unitOfMeasure: { symbol: 'UND' },
      },
    ],
  },
  {
    id: 'f1111111-1111-1111-1111-111111111112',
    sku: 'ARR-DIANA-1KG',
    name: 'Arroz Diana 1000g',
    category: { name: 'Granos y Abarrotes' },
    variants: [
      {
        id: 'f2222222-1111-1111-1111-111111111112',
        sku: 'ARR-DIANA-1KG',
        name: 'Arroz Diana 1000g',
        salePrice: 4800,
        taxRate: 0.0,
        unitOfMeasure: { symbol: 'KG' },
      },
    ],
  },
  {
    id: 'f1111111-1111-1111-1111-111111111113',
    sku: 'ACT-PREMIER-900',
    name: 'Aceite Premier 900ml',
    category: { name: 'Aceites' },
    variants: [
      {
        id: 'f2222222-1111-1111-1111-111111111113',
        sku: 'ACT-PREMIER-900',
        name: 'Aceite Premier 900ml',
        salePrice: 9500,
        taxRate: 0.19,
        unitOfMeasure: { symbol: 'UND' },
      },
    ],
  },
  {
    id: 'f1111111-1111-1111-1111-111111111114',
    sku: 'PAN-BIMBO-ART',
    name: 'Pan Bimbo Artesanal 500g',
    category: { name: 'Panadería' },
    variants: [
      {
        id: 'f2222222-1111-1111-1111-111111111114',
        sku: 'PAN-BIMBO-ART',
        name: 'Pan Bimbo Artesanal 500g',
        salePrice: 6200,
        taxRate: 0.05,
        unitOfMeasure: { symbol: 'UND' },
      },
    ],
  },
];

export function PosTerminalView({ user, token }: PosTerminalViewProps) {
  const router = useRouter();
  const [products, setProducts] = useState<ProductCatalogItem[]>(FALLBACK_PRODUCTS);
  const [loading, setLoading] = useState(false);
  const [activeShift, setActiveShift] = useState<any>(null);

  const items = usePosCartStore((state) => state.items);
  const isCheckoutModalOpen = usePosCartStore((state) => state.isCheckoutModalOpen);
  const setCheckoutModalOpen = usePosCartStore((state) => state.setCheckoutModalOpen);
  const setReceiptModalOpen = usePosCartStore((state) => state.setReceiptModalOpen);

  const branchId = user?.branchId || 'a1111111-1111-1111-1111-111111111111';
  const warehouseId = 'b1111111-1111-1111-1111-111111111111';

  // Manejo de atajos de teclado POS (F1, F2, ESC)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        router.push('/admin/help');
      } else if (e.key === 'F2') {
        e.preventDefault();
        if (items.length > 0) {
          setCheckoutModalOpen(true);
        }
      } else if (e.key === 'Escape') {
        if (isCheckoutModalOpen) {
          e.preventDefault();
          setCheckoutModalOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items.length, isCheckoutModalOpen, router, setCheckoutModalOpen]);

  useEffect(() => {
    if (token) {
      apiClient.setToken(token);
    }
    if (user?.tenantId) {
      apiClient.setTenantId(user.tenantId);
    }

    // Cargar catálogo de inventario y turno desde NestJS API Gateway
    const loadPosData = async () => {
      setLoading(true);
      try {
        const fetchedProducts = await apiClient.inventory.getProducts();
        if (Array.isArray(fetchedProducts) && fetchedProducts.length > 0) {
          setProducts(fetchedProducts);
        }
      } catch (err) {
        // En caso de que el backend esté desconectado o el catálogo esté vacío, usamos FALLBACK_PRODUCTS
        console.warn('Usando catálogo inicial en memoria para el terminal POS');
      }

      try {
        const shift = await apiClient.shifts.getCurrentShift();
        setActiveShift(shift);
      } catch (err) {
        // Ignorar si no hay turno abierto aún
      } finally {
        setLoading(false);
      }
    };

    loadPosData();
  }, [user, token]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-100">
      <HeaderNav
        user={user}
        branchName="Sucursal Principal #01"
      />

      <main className="flex-1 p-4 overflow-hidden">
        <div className="grid grid-cols-12 gap-4 h-full">
          {/* Catálogo de Productos y Búsqueda (Col 8) */}
          <section className="col-span-12 lg:col-span-8 h-full overflow-hidden">
            <ProductCatalog
              products={products}
              defaultWarehouseId={warehouseId}
            />
          </section>

          {/* Panel de Orden de Venta / Carrito (Col 4) */}
          <section className="col-span-12 lg:col-span-4 h-full overflow-hidden">
            <CartPanel />
          </section>
        </div>
      </main>

      {/* Modales de Checkout y Facturación */}
      <CheckoutModal
        branchId={branchId}
        posShiftId={activeShift?.id}
      />
      <ReceiptModal />
    </div>
  );
}

