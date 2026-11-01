'use client';

import React from 'react';
import {
  CheckCircle2,
  Printer,
  RotateCcw,
  Download,
  AlertTriangle,
  Receipt,
  X,
} from 'lucide-react';
import { usePosCartStore } from '@/store/pos-cart.store';
import { formatCOP, formatDateTime } from '@/lib/utils';

export function ReceiptModal() {
  const isOpen = usePosCartStore((state) => state.isReceiptModalOpen);
  const setIsOpen = usePosCartStore((state) => state.setReceiptModalOpen);
  const lastReceipt = usePosCartStore((state) => state.lastReceipt);
  const setLastReceipt = usePosCartStore((state) => state.setLastReceipt);

  if (!isOpen || !lastReceipt) return null;

  const handleNewSale = () => {
    setIsOpen(false);
    setLastReceipt(null);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      data-testid="receipt-modal"
    >
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Encabezado */}
        <div className="p-5 bg-emerald-600 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-200" />
            <div>
              <h2 className="text-lg font-bold">¡Venta Exitosa!</h2>
              <p className="text-xs text-emerald-100">Transacción confirmada en base de datos</p>
            </div>
          </div>
          <button
            onClick={handleNewSale}
            className="p-1 rounded-lg text-emerald-200 hover:text-white hover:bg-emerald-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Indicador de Replay Idempotente si corresponde */}
        {lastReceipt.isReplay && (
          <div
            className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center space-x-2 text-amber-800 text-xs font-semibold"
            data-testid="idempotent-replay-badge"
          >
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>REPETICIÓN IDEMPOTENTE: Esta factura ya había sido liquidada previamente con la misma clave.</span>
          </div>
        )}

        {/* Contenido del Recibo Térmico */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 font-mono text-xs text-slate-700 space-y-3 print:border-none print:shadow-none">
            <div className="text-center pb-3 border-b border-dashed border-slate-300">
              <h3 className="font-bold text-sm text-slate-900">UniSaaS Retail POS</h3>
              <p className="text-[11px] text-slate-500">Sistema Multi-Tenant POS & Cloud ERP</p>
              <p className="text-[11px] text-slate-500 mt-1">NIT: 900.123.456-7</p>
              <div className="mt-2 text-xs font-bold text-slate-800">
                FACTURA DE VENTA: <span data-testid="invoice-consecutive">{lastReceipt.consecutive}</span>
              </div>
              <div className="text-[11px] text-slate-500">
                Fecha: {formatDateTime(lastReceipt.createdAt)}
              </div>
            </div>

            {/* Totales y Liquidación */}
            <div className="space-y-1.5 py-2 border-b border-dashed border-slate-300">
              <div className="flex justify-between">
                <span>Subtotal Gravado:</span>
                <span>{formatCOP(lastReceipt.subtotal)}</span>
              </div>
              {lastReceipt.discountTotal > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Descuentos:</span>
                  <span>- {formatCOP(lastReceipt.discountTotal)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>IVA:</span>
                <span>{formatCOP(lastReceipt.taxTotal)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-200">
                <span>TOTAL PAGADO:</span>
                <span data-testid="receipt-total" className="text-emerald-700">{formatCOP(lastReceipt.total)}</span>
              </div>
            </div>

            {/* Datos de Pago y Vueltos */}
            <div className="space-y-1 py-2 text-[11px]">
              <div className="flex justify-between">
                <span>Medio de Pago:</span>
                <span className="font-bold uppercase">{lastReceipt.paymentMethod}</span>
              </div>
              {lastReceipt.cashTendered !== null && lastReceipt.cashTendered !== undefined && (
                <div className="flex justify-between">
                  <span>Efectivo Entregado:</span>
                  <span>{formatCOP(lastReceipt.cashTendered)}</span>
                </div>
              )}
              {lastReceipt.changeGiven !== null && lastReceipt.changeGiven !== undefined && (
                <div className="flex justify-between font-bold text-emerald-800">
                  <span>Cambio / Vueltos:</span>
                  <span data-testid="receipt-change">{formatCOP(lastReceipt.changeGiven)}</span>
                </div>
              )}
            </div>

            <div className="text-center pt-3 border-t border-dashed border-slate-300 text-[10px] text-slate-400">
              ¡Gracias por su compra!
              <br />
              ID Transacción: {lastReceipt.invoiceId}
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl flex items-center space-x-1.5 transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Imprimir Ticket</span>
          </button>

          <button
            type="button"
            data-testid="new-sale-btn"
            onClick={handleNewSale}
            className="px-6 py-2.5 rounded-xl font-bold text-sm bg-brand-primary hover:bg-brand-primary-hover text-white flex items-center space-x-2 shadow-md shadow-brand-primary/20 transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Nueva Venta</span>
          </button>
        </div>
      </div>
    </div>
  );
}

