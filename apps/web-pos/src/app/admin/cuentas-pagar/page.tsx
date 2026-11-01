'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatCOP } from '@/lib/currency';
import {
  ArrowLeft,
  Building2,
  Calendar,
  CreditCard,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Search,
  Filter,
  X,
  FileText,
  Phone,
} from 'lucide-react';

export interface SupplierPayableItem {
  id: string;
  name: string;
  documentNumber: string;
  phone: string;
  invoiceNumber: string;
  currentDebt: number;
  initialDebt: number;
  dueDate: string;
  issueDate: string;
  category: string;
}

export default function AdminCuentasPagarPage() {
  const [suppliers, setSuppliers] = useState<SupplierPayableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'TODOS' | 'VENCIDAS' | 'POR_VENCER' | 'AL_DIA'>('TODOS');

  const [selectedSupplierForPayment, setSelectedSupplierForPayment] = useState<SupplierPayableItem | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'EFECTIVO_CAJA' | 'TRANSFERENCIA' | 'CHEQUE'>('EFECTIVO_CAJA');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  const [showNewInvoiceModal, setShowNewInvoiceModal] = useState(false);
  const [newSupName, setNewSupName] = useState('');
  const [newSupNit, setNewSupNit] = useState('');
  const [newSupPhone, setNewSupPhone] = useState('');
  const [newSupInvoice, setNewSupInvoice] = useState('');
  const [newSupAmount, setNewSupAmount] = useState('');
  const [newSupDueDate, setNewSupDueDate] = useState('');
  const [newSupCategory, setNewSupCategory] = useState('Materia Prima e Insumos');
  const [isSubmittingNewInvoice, setIsSubmittingNewInvoice] = useState(false);

  const loadSuppliers = async () => {
    setLoading(true);
    let tenantId = 'tenant-demo-empresa-01';
    let isNew = false;

    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('unisaas_active_session');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const isDemoStore =
            (parsed?.user?.email === 'owner@demo.com' || parsed?.user?.email === 'admin@demo.com') &&
            (parsed?.tenant?.id === 'tenant-demo-empresa-01' ||
              parsed?.tenant?.id === '40000000-0000-0000-0000-000000000004' ||
              parsed?.tenant?.id === 'store-1') &&
            !parsed?.tenant?.isNewStore &&
            !parsed?.user?.isNewStore;

          isNew = !isDemoStore;
          tenantId = parsed?.tenant?.id || tenantId;
        } catch {}
      }
    }

    if (isNew) {
      setSuppliers([]);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/credits/suppliers', {
        headers: { 'x-tenant-id': tenantId },
      });
      if (res.ok) {
        const data = await res.json();
        setSuppliers(data);
      }
    } catch (err) {
      console.error('Error al cargar proveedores:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
    window.addEventListener('storage', loadSuppliers);
    window.addEventListener('unisaas_store_changed', loadSuppliers);
    return () => {
      window.removeEventListener('storage', loadSuppliers);
      window.removeEventListener('unisaas_store_changed', loadSuppliers);
    };
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];

  const getAgingStatus = (dueDate: string, currentDebt: number): 'AL_DIA' | 'POR_VENCER' | 'VENCIDA' => {
    if (currentDebt <= 0) return 'AL_DIA';
    const due = new Date(dueDate).getTime();
    const today = new Date(todayStr).getTime();
    const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'VENCIDA';
    if (diffDays <= 7) return 'POR_VENCER';
    return 'AL_DIA';
  };

  const filteredSuppliers = suppliers.filter((sup) => {
    const status = getAgingStatus(sup.dueDate, sup.currentDebt);
    const matchesSearch =
      sup.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sup.documentNumber.includes(searchQuery) ||
      sup.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'TODOS' ||
      (statusFilter === 'VENCIDAS' && status === 'VENCIDA') ||
      (statusFilter === 'POR_VENCER' && status === 'POR_VENCER') ||
      (statusFilter === 'AL_DIA' && status === 'AL_DIA');

    return matchesSearch && matchesStatus;
  });

  const totalDebt = suppliers.reduce((sum, s) => sum + s.currentDebt, 0);
  const overdueDebt = suppliers
    .filter((s) => getAgingStatus(s.dueDate, s.currentDebt) === 'VENCIDA')
    .reduce((sum, s) => sum + s.currentDebt, 0);
  const dueSoonDebt = suppliers
    .filter((s) => getAgingStatus(s.dueDate, s.currentDebt) === 'POR_VENCER')
    .reduce((sum, s) => sum + s.currentDebt, 0);
  const activeSuppliersCount = suppliers.filter((s) => s.currentDebt > 0).length;

  const handleOpenPayment = (sup: SupplierPayableItem) => {
    setSelectedSupplierForPayment(sup);
    setPaymentAmount('');
    setPaymentRef('');
    setPaymentError(null);
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierForPayment) return;

    const amount = parseFloat(paymentAmount) || 0;
    if (amount <= 0) {
      setPaymentError('El monto debe ser mayor a $0.');
      return;
    }

    if (amount > selectedSupplierForPayment.currentDebt) {
      setPaymentError(
        `El monto ($${amount}) supera la deuda pendiente (${formatCOP(selectedSupplierForPayment.currentDebt)}).`,
      );
      return;
    }

    setIsSubmittingPayment(true);
    setPaymentError(null);

    try {
      const res = await fetch(`/api/credits/suppliers/${selectedSupplierForPayment.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          paymentMethod,
          reference: paymentRef.trim() || undefined,
        }),
      });

      if (res.ok) {
        setSelectedSupplierForPayment(null);
        await loadSuppliers();
      } else {
        const errData = await res.json();
        setPaymentError(errData.message || 'Error al procesar abono.');
      }
    } catch {
      setPaymentError('Error de conexion al procesar abono.');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(newSupAmount) || 0;
    if (!newSupName.trim() || !newSupNit.trim() || amount <= 0) return;

    setIsSubmittingNewInvoice(true);
    try {
      const res = await fetch('/api/credits/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSupName,
          documentNumber: newSupNit,
          phone: newSupPhone || '3000000000',
          invoiceNumber: newSupInvoice || `FC-${Math.floor(1000 + Math.random() * 9000)}`,
          currentDebt: amount,
          dueDate: newSupDueDate || todayStr,
          category: newSupCategory,
        }),
      });

      if (res.ok) {
        setShowNewInvoiceModal(false);
        setNewSupName('');
        setNewSupNit('');
        setNewSupPhone('');
        setNewSupInvoice('');
        setNewSupAmount('');
        setNewSupDueDate('');
        await loadSuppliers();
      }
    } catch (err) {
      console.error('Error al crear factura de proveedor:', err);
    } finally {
      setIsSubmittingNewInvoice(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#18668F]" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Cuentas por Pagar a Proveedores
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Módulo de compras, vencimientos y amortización de pasivos comerciales (Squad 7)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowNewInvoiceModal(true)}
            className="px-3.5 py-2 bg-[#18668F] hover:bg-[#135273] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Nueva Factura Proveedor</span>
          </button>
          <Link
            href="/admin/balance"
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center space-x-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Balance Operativo</span>
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <Link
          href="/admin/clients"
          className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
        >
          Cuentas por Cobrar (Clientes / Fiado)
        </Link>
        <span className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[#18668F] text-white">
          Cuentas por Pagar (Proveedores)
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Total por Pagar</span>
            <DollarSign className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl font-mono font-extrabold text-slate-900">
            {formatCOP(totalDebt)}
          </div>
          <div className="text-[11px] text-slate-400">Pasivo comercial corriente</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-rose-200 shadow-xs space-y-1 bg-rose-50/20">
          <div className="flex items-center justify-between text-rose-700 text-xs font-bold">
            <span>Facturas Vencidas</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl font-mono font-extrabold text-rose-600">
            {formatCOP(overdueDebt)}
          </div>
          <div className="text-[11px] text-rose-500">Exige pago inmediato</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs space-y-1 bg-amber-50/20">
          <div className="flex items-center justify-between text-amber-700 text-xs font-bold">
            <span>Por Vencer (7 Días)</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-mono font-extrabold text-amber-700">
            {formatCOP(dueSoonDebt)}
          </div>
          <div className="text-[11px] text-amber-600">Próximo compromiso de caja</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Proveedores Pendientes</span>
            <Building2 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl font-mono font-extrabold text-slate-900">
            {activeSuppliersCount}
          </div>
          <div className="text-[11px] text-slate-400">Con saldo mayor a $0</div>
        </div>
      </div>

      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por proveedor, NIT o factura..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 rounded-xl text-slate-800 text-xs border-0 focus:ring-2 focus:ring-[#18668F]"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400 mr-1 hidden sm:block" />
          <button
            type="button"
            onClick={() => setStatusFilter('TODOS')}
            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer transition-colors ${
              statusFilter === 'TODOS'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todos ({suppliers.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('VENCIDAS')}
            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer transition-colors ${
              statusFilter === 'VENCIDAS'
                ? 'bg-rose-600 text-white'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            Vencidas
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('POR_VENCER')}
            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer transition-colors ${
              statusFilter === 'POR_VENCER'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            Por Vencer
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('AL_DIA')}
            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer transition-colors ${
              statusFilter === 'AL_DIA'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            Al Día / Pagadas
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase">
                <th className="py-3 px-4">Documento / NIT</th>
                <th className="py-3 px-4">Proveedor / Categoría</th>
                <th className="py-3 px-4">Factura Comercial</th>
                <th className="py-3 px-4">Vencimiento</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-right">Monto Factura</th>
                <th className="py-3 px-4 text-right">Saldo Pendiente</th>
                <th className="py-3 px-4 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 font-medium text-xs">
                    Esta empresa inicia con 0 cuentas por pagar a proveedores. Para registrar una obligación, use el botón superior "+ Nueva Factura Proveedor".
                  </td>
                </tr>
              ) : (
                filteredSuppliers.map((sup) => {
                  const aging = getAgingStatus(sup.dueDate, sup.currentDebt);
                  return (
                    <tr key={sup.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-slate-700">
                        {sup.documentNumber}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{sup.name}</div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span>{sup.category}</span>
                          {sup.phone && (
                            <span className="flex items-center gap-0.5 text-slate-500 font-mono">
                              <Phone className="w-2.5 h-2.5" />
                              {sup.phone}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">
                        <div className="flex items-center gap-1">
                          <FileText className="w-3 h-3 text-slate-400" />
                          <span>{sup.invoiceNumber}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{sup.dueDate}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {aging === 'VENCIDA' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
                            VENCIDA
                          </span>
                        )}
                        {aging === 'POR_VENCER' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
                            POR VENCER
                          </span>
                        )}
                        {aging === 'AL_DIA' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {sup.currentDebt === 0 ? 'PAGADA' : 'VIGENTE'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-500">
                        {formatCOP(sup.initialDebt)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-extrabold text-slate-900">
                        <span className={sup.currentDebt > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                          {formatCOP(sup.currentDebt)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {sup.currentDebt > 0 ? (
                          <button
                            type="button"
                            onClick={() => handleOpenPayment(sup)}
                            className="px-3 py-1 bg-[#18668F] hover:bg-[#135273] text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                          >
                            Abonar / Pagar
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Paz y Salvo</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedSupplierForPayment && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-sm">
                Registrar Abono a Proveedor
              </h3>
              <button
                type="button"
                onClick={() => setSelectedSupplierForPayment(null)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl space-y-1 text-xs">
              <div className="font-bold text-slate-900">{selectedSupplierForPayment.name}</div>
              <div className="text-slate-500 font-mono text-[11px]">
                NIT: {selectedSupplierForPayment.documentNumber} | Factura: {selectedSupplierForPayment.invoiceNumber}
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-200 font-bold">
                <span className="text-slate-600">Saldo Pendiente:</span>
                <span className="text-rose-600 font-mono text-sm">
                  {formatCOP(selectedSupplierForPayment.currentDebt)}
                </span>
              </div>
            </div>

            <form onSubmit={handleConfirmPayment} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Monto a Abonar ($ COP):</label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    placeholder="Ej. 1000000"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full p-2 bg-slate-50 rounded-xl text-slate-800 font-mono font-bold text-sm border-0 focus:ring-2 focus:ring-[#18668F]"
                  />
                  <button
                    type="button"
                    onClick={() => setPaymentAmount(selectedSupplierForPayment.currentDebt.toString())}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 bg-blue-50 text-[#18668F] font-bold text-[10px] rounded hover:bg-blue-100 cursor-pointer"
                  >
                    Pagar Todo
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Medio de Pago:</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full p-2 bg-slate-50 rounded-xl text-slate-800 font-medium border-0 focus:ring-2 focus:ring-[#18668F]"
                >
                  <option value="EFECTIVO_CAJA">Efectivo (Egreso de Caja Mostrador)</option>
                  <option value="TRANSFERENCIA">Transferencia Bancaria (Bancolombia/Davivienda)</option>
                  <option value="CHEQUE">Cheque Comercial</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Comprobante / Referencia (Opcional):</label>
                <input
                  type="text"
                  placeholder="Ej. TRANSF-091823 o Recibo Egreso #45"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="w-full p-2 bg-slate-50 rounded-xl text-slate-800 border-0 focus:ring-2 focus:ring-[#18668F]"
                />
              </div>

              {paymentError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-[11px] font-bold">
                  {paymentError}
                </div>
              )}

              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="flex-1 py-2.5 bg-[#18668F] hover:bg-[#135273] text-white font-bold text-xs rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingPayment ? 'Registrando...' : 'Confirmar Abono'}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSupplierForPayment(null)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showNewInvoiceModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-sm">
                Registrar Factura de Proveedor
              </h3>
              <button
                type="button"
                onClick={() => setShowNewInvoiceModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Nombre o Razón Social:</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Distribuidora Avícola Los Andes"
                  value={newSupName}
                  onChange={(e) => setNewSupName(e.target.value)}
                  className="w-full p-2 bg-slate-50 rounded-xl text-slate-800 border-0 focus:ring-2 focus:ring-[#18668F]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">NIT / Cédula:</label>
                  <input
                    type="text"
                    required
                    placeholder="901234567-8"
                    value={newSupNit}
                    onChange={(e) => setNewSupNit(e.target.value)}
                    className="w-full p-2 bg-slate-50 rounded-xl text-slate-800 font-mono border-0 focus:ring-2 focus:ring-[#18668F]"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Teléfono / Celular:</label>
                  <input
                    type="text"
                    placeholder="3116549870"
                    value={newSupPhone}
                    onChange={(e) => setNewSupPhone(e.target.value)}
                    className="w-full p-2 bg-slate-50 rounded-xl text-slate-800 font-mono border-0 focus:ring-2 focus:ring-[#18668F]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Factura Comercial:</label>
                  <input
                    type="text"
                    placeholder="FC-11029"
                    value={newSupInvoice}
                    onChange={(e) => setNewSupInvoice(e.target.value)}
                    className="w-full p-2 bg-slate-50 rounded-xl text-slate-800 font-mono border-0 focus:ring-2 focus:ring-[#18668F]"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Fecha Vencimiento:</label>
                  <input
                    type="date"
                    required
                    value={newSupDueDate}
                    onChange={(e) => setNewSupDueDate(e.target.value)}
                    className="w-full p-2 bg-slate-50 rounded-xl text-slate-800 font-mono border-0 focus:ring-2 focus:ring-[#18668F]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Monto de la Factura ($ COP):</label>
                <input
                  type="number"
                  required
                  placeholder="Ej. 1850000"
                  value={newSupAmount}
                  onChange={(e) => setNewSupAmount(e.target.value)}
                  className="w-full p-2 bg-slate-50 rounded-xl text-slate-800 font-mono font-bold text-sm border-0 focus:ring-2 focus:ring-[#18668F]"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Categoría de Compra:</label>
                <select
                  value={newSupCategory}
                  onChange={(e) => setNewSupCategory(e.target.value)}
                  className="w-full p-2 bg-slate-50 rounded-xl text-slate-800 border-0 focus:ring-2 focus:ring-[#18668F]"
                >
                  <option value="Materia Prima e Insumos">Materia Prima e Insumos</option>
                  <option value="Bebidas y Licores">Bebidas y Licores</option>
                  <option value="Carnes y Fríos">Carnes y Fríos</option>
                  <option value="Empaques y Desechables">Empaques y Desechables</option>
                  <option value="Aseo y Limpieza">Aseo y Limpieza</option>
                  <option value="Servicios y Arriendos">Servicios y Arriendos</option>
                </select>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingNewInvoice}
                  className="flex-1 py-2.5 bg-[#18668F] hover:bg-[#135273] text-white font-bold text-xs rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingNewInvoice ? 'Guardando...' : 'Guardar Factura'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewInvoiceModal(false)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

