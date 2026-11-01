'use client';

import React from 'react';
import { ShoppingCart, Trash2, Plus, Minus, ArrowRight } from 'lucide-react';
import { usePosCartStore } from '@/store/pos-cart.store';
import { formatCOP } from '@/lib/utils';

export function CartPanel() {
  const items = usePosCartStore((state) => state.items);
  const updateQuantity = usePosCartStore((state) => state.updateQuantity);
  const removeItem = usePosCartStore((state) => state.removeItem);
  const clearCart = usePosCartStore((state) => state.clearCart);
  const setCheckoutModalOpen = usePosCartStore((state) => state.setCheckoutModalOpen);
  const customer = usePosCartStore((state) => state.customer);

  const getSubtotal = usePosCartStore((state) => state.getSubtotal);
  const getTaxTotal = usePosCartStore((state) => state.getTaxTotal);
  const getTotal = usePosCartStore((state) => state.getTotal);

  const subtotal = getSubtotal();
  const taxTotal = getTaxTotal();
  const total = getTotal();

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Encabezado del Carrito y Cliente */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <ShoppingCart className="w-5 h-5 text-brand-primary" />
          <h2 className="font-semibold text-slate-800">Orden de Venta</h2>
          <span className="text-xs bg-slate-100 font-bold px-2 py-0.5 rounded-full text-slate-600">
            {items.reduce((acc, i) => acc + i.quantity, 0)}
          </span>
        </div>

        {items.length > 0 && (
          <button
            onClick={clearCart}
            className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center space-x-1 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Vaciar</span>
          </button>
        )}
      </div>

      {/* Cliente asignado */}
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs">
        <span className="text-slate-500">Cliente:</span>
        <span className="font-medium text-slate-800 truncate max-w-[180px]">
          {customer.name} ({customer.documentNumber})
        </span>
      </div>

      {/* Lista de Ítems */}
      <div className="flex-1 p-4 overflow-y-auto divide-y divide-slate-100">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <ShoppingCart className="w-10 h-10 mb-2 stroke-1 text-slate-300" />
            <p className="text-sm">El carrito está vacío</p>
            <p className="text-xs text-slate-400 mt-1">Seleccione productos del catálogo para comenzar</p>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.variantId} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between">
              <div className="flex-1 pr-3">
                <h4 className="text-sm font-medium text-slate-800 leading-tight">{item.productName}</h4>
                <div className="flex items-center space-x-2 text-xs text-slate-400 mt-1">
                  <span>{formatCOP(item.unitPrice)}</span>
                  <span>•</span>
                  <span>IVA {item.taxRate}%</span>
                </div>
              </div>

              {/* Controles de Cantidad */}
              <div className="flex items-center space-x-2">
                <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50">
                  <button
                    onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                    className="p-1 hover:bg-slate-200 text-slate-600 rounded-l-lg transition-colors"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-8 text-center text-xs font-semibold text-slate-800">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                    className="p-1 hover:bg-slate-200 text-slate-600 rounded-r-lg transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                <span className="w-20 text-right text-sm font-bold text-slate-900">
                  {formatCOP(item.total)}
                </span>

                <button
                  onClick={() => removeItem(item.variantId)}
                  className="p-1 text-slate-400 hover:text-red-500 transition-colors ml-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Resumen de Totales y Botón de Pago */}
      <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3">
        <div className="space-y-1.5 text-xs text-slate-600">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="font-medium text-slate-800">{formatCOP(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Impuestos (IVA)</span>
            <span className="font-medium text-slate-800">{formatCOP(taxTotal)}</span>
          </div>
          <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
            <span>Total a Pagar</span>
            <span className="text-brand-primary">{formatCOP(total)}</span>
          </div>
        </div>

        <button
          onClick={() => setCheckoutModalOpen(true)}
          disabled={items.length === 0}
          className={`w-full py-3 px-4 rounded-xl font-bold flex items-center justify-center space-x-2 transition-all shadow-md ${
            items.length === 0
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              : 'bg-brand-secondary hover:bg-brand-secondary-hover text-white shadow-brand-secondary/20'
          }`}
        >
          <span>Cobrar Venta</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

