'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  CreditCard,
  Banknote,
  Smartphone,
  UserCheck,
  AlertCircle,
  Printer,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { usePosCartStore, CustomerInfo } from '@/store/pos-cart.store';
import { apiClient } from '@/lib/api-client';
import { formatCOP } from '@/lib/utils';

interface CheckoutModalProps {
  branchId?: string;
  posShiftId?: string;
}

export function CheckoutModal({ branchId = '11111111-1111-1111-1111-111111111111', posShiftId }: CheckoutModalProps) {
  const isOpen = usePosCartStore((state) => state.isCheckoutModalOpen);
  const setIsOpen = usePosCartStore((state) => state.setCheckoutModalOpen);
  const items = usePosCartStore((state) => state.items);
  const customer = usePosCartStore((state) => state.customer);
  const setCustomer = usePosCartStore((state) => state.setCustomer);
  const paymentMethod = usePosCartStore((state) => state.paymentMethod);
  const setPaymentMethod = usePosCartStore((state) => state.setPaymentMethod);
  const cashTendered = usePosCartStore((state) => state.cashTendered);
  const setCashTendered = usePosCartStore((state) => state.setCashTendered);
  const isProcessing = usePosCartStore((state) => state.isProcessing);
  const setProcessing = usePosCartStore((state) => state.setProcessing);
  const setLastReceipt = usePosCartStore((state) => state.setLastReceipt);
  const setReceiptModalOpen = usePosCartStore((state) => state.setReceiptModalOpen);
  const clearCart = usePosCartStore((state) => state.clearCart);

  const getSubtotal = usePosCartStore((state) => state.getSubtotal);
  const getTaxTotal = usePosCartStore((state) => state.getTaxTotal);
  const getTotal = usePosCartStore((state) => state.getTotal);

  const total = getTotal();
  const subtotal = getSubtotal();
  const taxTotal = getTaxTotal();

  const [printTicket, setPrintTicket] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');

  // Generar idempotencyKey al abrir el modal
  useEffect(() => {
    if (isOpen) {
      setIdempotencyKey(crypto.randomUUID());
      setErrorMessage(null);
      if (paymentMethod === 'EFECTIVO' && cashTendered === 0) {
        setCashTendered(total);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const change = Math.max(0, cashTendered - total);
  const isCashInsufficient = paymentMethod === 'EFECTIVO' && cashTendered < total;

  const handleQuickCash = (amount: number) => {
    setCashTendered(amount);
  };

  const handleExactCash = () => {
    setCashTendered(total);
  };

  const handleCheckoutSubmit = async () => {
    if (items.length === 0) {
      setErrorMessage('El carrito no contiene productos');
      return;
    }

    if (isCashInsufficient) {
      setErrorMessage(`El monto entregado ($${formatCOP(cashTendered)}) es insuficiente para cubrir el total ($${formatCOP(total)})`);
      return;
    }

    setProcessing(true);
    setErrorMessage(null);

    try {
      const checkoutDto = {
        branchId,
        posShiftId: posShiftId || undefined,
        items: items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          warehouseId: i.warehouseId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          taxRate: i.taxRate,
          discountRate: i.discountRate,
        })),
        payment: {
          method: paymentMethod,
          cashTendered: paymentMethod === 'EFECTIVO' ? cashTendered : undefined,
          customerDocument: customer.documentNumber,
          customerName: customer.name,
          customerId: customer.id,
        },
        printTicket,
        ticketWidth: 80 as const,
      };

      const result = await apiClient.checkout.execute(checkoutDto, idempotencyKey);

      // Guardar comprobante en el store
      setLastReceipt({
        success: true,
        invoiceId: result.invoiceId,
        consecutive: result.consecutive,
        subtotal: result.subtotal ?? subtotal,
        discountTotal: result.discountTotal ?? 0,
        taxTotal: result.taxTotal ?? taxTotal,
        total: result.total ?? total,
        paymentMethod: result.paymentMethod || paymentMethod,
        cashTendered: result.cashTendered ?? (paymentMethod === 'EFECTIVO' ? cashTendered : null),
        changeGiven: result.changeGiven ?? (paymentMethod === 'EFECTIVO' ? change : null),
        ticketBase64: result.ticketBase64,
        isReplay: result.isReplay,
        createdAt: result.createdAt || new Date().toISOString(),
      });

      // Limpiar y cerrar modal de checkout, abrir modal de recibo
      clearCart();
      setIsOpen(false);
      setReceiptModalOpen(true);
    } catch (err: any) {
      console.error('Error durante el checkout POS:', err);
      if (err.statusCode === 409) {
        setErrorMessage('Conflicto de concurrencia: stock insuficiente o clave duplicada en proceso.');
      } else if (err.statusCode === 401) {
        setErrorMessage('Sesión expirada. Por favor, vuelva a iniciar sesión.');
      } else if (err.statusCode === 503) {
        setErrorMessage('Servicio no disponible temporalmente. Verifique la conexión con el servidor.');
      } else {
        setErrorMessage(err.message || 'Error al procesar el pago. Intente nuevamente.');
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      data-testid="checkout-modal"
    >
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Encabezado */}
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Finalizar Venta POS</h2>
            <p className="text-xs text-slate-400">Total a liquidar: <span className="text-emerald-400 font-semibold text-sm">{formatCOP(total)}</span></p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            disabled={isProcessing}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensaje de error si ocurre */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-2 text-red-700 text-sm" data-testid="checkout-error-banner">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
            <span className="flex-1 font-medium">{errorMessage}</span>
          </div>
        )}

        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Métodos de Pago */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Selecciona Medio de Pago
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                data-testid="pay-method-cash"
                onClick={() => setPaymentMethod('EFECTIVO')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                  paymentMethod === 'EFECTIVO'
                    ? 'border-brand-primary bg-sky-50 text-brand-primary font-bold shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                <Banknote className="w-6 h-6 mb-1 text-emerald-600" />
                <span className="text-xs">Efectivo</span>
              </button>

              <button
                type="button"
                data-testid="pay-method-nequi"
                onClick={() => setPaymentMethod('NEQUI')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                  paymentMethod === 'NEQUI'
                    ? 'border-brand-primary bg-sky-50 text-brand-primary font-bold shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                <Smartphone className="w-6 h-6 mb-1 text-purple-600" />
                <span className="text-xs">Nequi</span>
              </button>

              <button
                type="button"
                data-testid="pay-method-daviplata"
                onClick={() => setPaymentMethod('DAVIPLATA')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                  paymentMethod === 'DAVIPLATA'
                    ? 'border-brand-primary bg-sky-50 text-brand-primary font-bold shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                <Smartphone className="w-6 h-6 mb-1 text-red-600" />
                <span className="text-xs">Daviplata</span>
              </button>

              <button
                type="button"
                data-testid="pay-method-card"
                onClick={() => setPaymentMethod('TARJETA')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                  paymentMethod === 'TARJETA'
                    ? 'border-brand-primary bg-sky-50 text-brand-primary font-bold shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                <CreditCard className="w-6 h-6 mb-1 text-blue-600" />
                <span className="text-xs">Tarjeta Déb./Créd.</span>
              </button>

              <button
                type="button"
                data-testid="pay-method-credit"
                onClick={() => setPaymentMethod('CREDITO_FIADO')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all col-span-2 ${
                  paymentMethod === 'CREDITO_FIADO'
                    ? 'border-brand-primary bg-sky-50 text-brand-primary font-bold shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                <UserCheck className="w-6 h-6 mb-1 text-amber-600" />
                <span className="text-xs">Crédito / Fiado (Cartera)</span>
              </button>
            </div>
          </div>

          {/* Opciones según medio de pago: EFECTIVO */}
          {paymentMethod === 'EFECTIVO' && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase">
                  Monto Recibido del Cliente
                </label>
                <button
                  type="button"
                  onClick={handleExactCash}
                  className="text-xs text-brand-primary hover:underline font-semibold"
                >
                  Paga Exacto ({formatCOP(total)})
                </button>
              </div>

              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 font-bold">$</span>
                <input
                  type="number"
                  step="100"
                  min="0"
                  data-testid="cash-tendered-input"
                  value={cashTendered || ''}
                  onChange={(e) => setCashTendered(Number(e.target.value))}
                  placeholder="0"
                  className="w-full pl-8 pr-4 py-2 text-lg font-bold text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>

              {/* Botones de billetes rápidos (Colombia COP) */}
              <div className="flex flex-wrap gap-2">
                {[10000, 20000, 50000, 100000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleQuickCash(val)}
                    className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 hover:border-slate-400 rounded-lg text-slate-700 transition-colors shadow-sm"
                  >
                    + {formatCOP(val)}
                  </button>
                ))}
              </div>

              {/* Cálculo de Cambio / Vuelto */}
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-600">Cambio / Vueltos:</span>
                <span
                  className={`text-lg font-extrabold ${
                    isCashInsufficient ? 'text-red-500' : 'text-emerald-600'
                  }`}
                  data-testid="change-amount"
                >
                  {isCashInsufficient ? 'Monto Insuficiente' : formatCOP(change)}
                </span>
              </div>
            </div>
          )}

          {/* Opciones según medio de pago: CREDITO_FIADO */}
          {paymentMethod === 'CREDITO_FIADO' && (
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 space-y-3">
              <div className="flex items-center space-x-2 text-amber-800 text-sm font-semibold">
                <UserCheck className="w-5 h-5 text-amber-600" />
                <span>Venta a Crédito / Fiado para {customer.name}</span>
              </div>
              <p className="text-xs text-amber-700">
                La venta generará una cuenta por cobrar (cartera) y afectará el cupo disponible del cliente.
              </p>
              {customer.creditLimit !== undefined && (
                <div className="text-xs flex justify-between pt-2 border-t border-amber-200">
                  <span>Cupo Total: {formatCOP(customer.creditLimit)}</span>
                  <span>Deuda Actual: {formatCOP(customer.currentDebt || 0)}</span>
                  <span className="font-bold text-amber-900">
                    Cupo Libre: {formatCOP(customer.creditLimit - (customer.currentDebt || 0))}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Opciones adicionales: Imprimir Ticket */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center space-x-2">
              <Printer className="w-4 h-4 text-slate-600" />
              <span className="text-sm font-medium text-slate-700">Imprimir Comprobante Térmico (ESC/POS)</span>
            </div>
            <input
              type="checkbox"
              checked={printTicket}
              onChange={(e) => setPrintTicket(e.target.checked)}
              className="w-4 h-4 text-brand-primary rounded focus:ring-brand-primary"
            />
          </div>

          {/* Metadatos Idempotencia */}
          <div className="text-[11px] text-slate-400 font-mono truncate">
            Clave Idempotencia: {idempotencyKey}
          </div>
        </div>

        {/* Pie del Modal con Botones */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            disabled={isProcessing}
            className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            data-testid="confirm-checkout-btn"
            onClick={handleCheckoutSubmit}
            disabled={isProcessing || isCashInsufficient}
            className={`px-6 py-2.5 rounded-xl font-bold text-sm flex items-center space-x-2 shadow-md transition-all ${
              isProcessing || isCashInsufficient
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
            }`}
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Procesando Venta...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirmar Pago {formatCOP(total)}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

