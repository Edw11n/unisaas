'use client';

import React, { useState } from 'react';
import {
  FileText,
  Search,
  Printer,
  Ban,
  CheckCircle2,
  X,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import { formatCOP } from '@/lib/currency';

export default function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([
    {
      id: 'inv-1048',
      invoiceNumber: 'POS-001048',
      date: new Date().toLocaleDateString('es-CO'),
      time: '10:35 AM',
      customerName: 'Cliente Ocasional',
      customerDoc: '222222222222',
      paymentMethod: 'EFECTIVO',
      subtotal: 71428,
      tax: 13572,
      total: 85000,
      status: 'ISSUED',
      items: [
        { name: 'Arroz Florhuila 1kg', qty: 10, unitPrice: 4500, total: 45000 },
        { name: 'Aceite Premier 1000ml', qty: 4, unitPrice: 10000, total: 40000 },
      ],
    },
    {
      id: 'inv-1047',
      invoiceNumber: 'POS-001047',
      date: new Date().toLocaleDateString('es-CO'),
      time: '09:12 AM',
      customerName: 'Carlos Mario Gómez',
      customerDoc: '1020304050',
      paymentMethod: 'NEQUI',
      subtotal: 100840,
      tax: 19160,
      total: 120000,
      status: 'ISSUED',
      items: [
        { name: 'Pintura Pintuco Galón', qty: 1, unitPrice: 120000, total: 120000 },
      ],
    },
    {
      id: 'inv-1046',
      invoiceNumber: 'POS-001046',
      date: new Date(Date.now() - 86400000).toLocaleDateString('es-CO'),
      time: '04:45 PM',
      customerName: 'Supermercado La Colina',
      customerDoc: '900123456-1',
      paymentMethod: 'CREDITO',
      subtotal: 285714,
      tax: 54286,
      total: 340000,
      status: 'ISSUED',
      items: [
        { name: 'Bulto Harina de Trigo 50kg', qty: 2, unitPrice: 170000, total: 340000 },
      ],
    },
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [invoiceToVoid, setInvoiceToVoid] = useState<any>(null);
  const [voidReason, setVoidReason] = useState('Error en digitación');

  const filtered = invoices.filter(
    (inv) =>
      inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleVoidInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceToVoid) return;

    setInvoices(
      invoices.map((inv) =>
        inv.id === invoiceToVoid.id ? { ...inv, status: 'VOIDED' } : inv,
      ),
    );
    setInvoiceToVoid(null);
    setSelectedInvoice(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Ventas, Facturas & Caja</h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Historial oficial de facturas emitidas, desglose tributario, anulación auditada e impresión térmica.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por consecutivo POS o nombre de cliente..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-sky-500 outline-none"
          />
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Consecutivo</th>
                <th className="py-3 px-4">Fecha & Hora</th>
                <th className="py-3 px-4">Cliente</th>
                <th className="py-3 px-4">Medio de Pago</th>
                <th className="py-3 px-4 text-right">Base Gravable</th>
                <th className="py-3 px-4 text-right">IVA</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((inv) => {
                const isVoided = inv.status === 'VOIDED';
                return (
                  <tr key={inv.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-4 font-mono font-bold text-sky-700">{inv.invoiceNumber}</td>
                    <td className="py-3 px-4 text-slate-500">{inv.date} {inv.time}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">{inv.customerName}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                        {inv.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">{formatCOP(inv.subtotal)}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">{formatCOP(inv.tax)}</td>
                    <td className="py-3 px-4 text-right font-mono font-black text-slate-900">{formatCOP(inv.total)}</td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isVoided
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {isVoided ? 'ANULADA' : 'EMITIDA'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          className="p-1 text-slate-600 hover:text-sky-700 hover:bg-slate-100 rounded"
                          title="Ver Detalle"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {!isVoided && (
                          <button
                            onClick={() => setInvoiceToVoid(inv)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                            title="Anular Factura"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Detalle de Factura */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Comprobante {selectedInvoice.invoiceNumber}
              </h3>
              <button onClick={() => setSelectedInvoice(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl space-y-1">
              <p><strong>Cliente:</strong> {selectedInvoice.customerName} ({selectedInvoice.customerDoc})</p>
              <p><strong>Fecha:</strong> {selectedInvoice.date} {selectedInvoice.time}</p>
              <p><strong>Método:</strong> {selectedInvoice.paymentMethod}</p>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                  <tr>
                    <th className="p-2">Ítem</th>
                    <th className="p-2 text-center">Cant.</th>
                    <th className="p-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedInvoice.items?.map((it: any, idx: number) => (
                    <tr key={idx}>
                      <td className="p-2">{it.name}</td>
                      <td className="p-2 text-center">{it.qty}</td>
                      <td className="p-2 text-right font-mono">{formatCOP(it.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-1 text-right">
              <p className="text-slate-500">Base Gravable: <span className="font-mono">{formatCOP(selectedInvoice.subtotal)}</span></p>
              <p className="text-slate-500">IVA (19%): <span className="font-mono">{formatCOP(selectedInvoice.tax)}</span></p>
              <p className="text-sm font-black text-slate-900">Total: <span className="font-mono">{formatCOP(selectedInvoice.total)}</span></p>
            </div>

            <div className="pt-3 flex justify-between">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-50 rounded-xl font-bold flex items-center space-x-1.5"
              >
                <Printer className="w-4 h-4 text-slate-600" />
                <span>Imprimir Ticket</span>
              </button>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-5 py-2 bg-slate-900 text-white font-bold rounded-xl"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Anular Factura */}
      {invoiceToVoid && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4 text-xs">
            <div className="flex items-center space-x-2 text-rose-600 font-bold text-base">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span>Anulación de Factura POS</span>
            </div>

            <p className="text-slate-600">
              ¿Está seguro de anular el comprobante <strong>{invoiceToVoid.invoiceNumber}</strong> por <strong>{formatCOP(invoiceToVoid.total)}</strong>?
            </p>
            <p className="text-slate-500 text-[11px]">
              Esta acción reversará el asiento contable en Squad 2 y reingresará los productos al Kardex en Squad 3 de manera auditada.
            </p>

            <form onSubmit={handleVoidInvoice} className="space-y-4">
              <div>
                <label className="block font-semibold mb-1">Motivo de Anulación *</label>
                <select
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none bg-white"
                >
                  <option value="Error en digitación">Error en digitación / cobro</option>
                  <option value="Devolución de cliente">Devolución total del cliente</option>
                  <option value="Medio de pago incorrecto">Medio de pago incorrecto</option>
                  <option value="Prueba operativa">Prueba operativa</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setInvoiceToVoid(null)}
                  className="px-4 py-2 border border-slate-300 font-semibold rounded-lg hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg"
                >
                  Confirmar Anulación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

