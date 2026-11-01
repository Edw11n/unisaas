'use client';

import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Search,
  Plus,
  DollarSign,
  TrendingDown,
  ShoppingBag,
  Building,
  Filter,
  X,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import { formatCOP } from '@/lib/currency';

interface ExpenseItem {
  id: string;
  date: string;
  voucherNumber: string;
  type: 'GASTO_OPERATIVO' | 'COMPRA_PROVEEDOR';
  beneficiary: string;
  category: string;
  paymentMethod: 'EFECTIVO_CAJA' | 'TRANSFERENCIA' | 'CREDITO_PROVEEDOR';
  amount: number;
  description: string;
  registeredBy: string;
}

const DEMO_EXPENSES: ExpenseItem[] = [
  {
    id: 'exp-1',
    date: 'Hoy, 10:30 AM',
    voucherNumber: 'CE-0045',
    type: 'GASTO_OPERATIVO',
    beneficiary: 'Supermercado Demo',
    category: 'Insumos de Cocina',
    paymentMethod: 'EFECTIVO_CAJA',
    amount: 45000,
    description: 'Compra de verduras frescas y limones para servicio del almuerzo',
    registeredBy: 'Cajero Principal',
  },
  {
    id: 'exp-2',
    date: 'Ayer, 03:15 PM',
    voucherNumber: 'FP-9821',
    type: 'COMPRA_PROVEEDOR',
    beneficiary: 'Proveedor Carnes Demo S.A.S.',
    category: 'Materia Prima (Carnes)',
    paymentMethod: 'TRANSFERENCIA',
    amount: 1450000,
    description: 'Despacho de lomos finos y costillas segun orden de compra OC-0089',
    registeredBy: 'Supervisor Demo',
  },
  {
    id: 'exp-3',
    date: '15 Oct 2026',
    voucherNumber: 'CE-0044',
    type: 'GASTO_OPERATIVO',
    beneficiary: 'Empresa de Energia Demo',
    category: 'Servicios Publicos',
    paymentMethod: 'TRANSFERENCIA',
    amount: 280000,
    description: 'Pago factura de energia electrica sede principal',
    registeredBy: 'Supervisor Demo',
  },
  {
    id: 'exp-4',
    date: '14 Oct 2026',
    voucherNumber: 'CE-0043',
    type: 'GASTO_OPERATIVO',
    beneficiary: 'Distribuidora de Gas Demo',
    category: 'Servicios Publicos',
    paymentMethod: 'EFECTIVO_CAJA',
    amount: 160000,
    description: 'Recarga de dos cilindros de gas industrial 100lb',
    registeredBy: 'Cajero Principal',
  },
];

export default function AdminGastosPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('TODAS');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Estados del Formulario
  const [newType, setNewType] = useState<'GASTO_OPERATIVO' | 'COMPRA_PROVEEDOR'>('GASTO_OPERATIVO');
  const [newBeneficiary, setNewBeneficiary] = useState('');
  const [newCategory, setNewCategory] = useState('Insumos de Cocina');
  const [newMethod, setNewMethod] = useState<'EFECTIVO_CAJA' | 'TRANSFERENCIA' | 'CREDITO_PROVEEDOR'>('EFECTIVO_CAJA');
  const [newAmount, setNewAmount] = useState('');
  const [newVoucher, setNewVoucher] = useState('');
  const [newDescription, setNewDescription] = useState('');

  // Comercios nuevos inician con $0 egresos y tabla limpia
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);

  const categories = [
    'Insumos de Cocina',
    'Materia Prima (Carnes)',
    'Servicios Publicos',
    'Aseo y Desinfeccion',
    'Mantenimiento Locativo',
    'Nomina y Jornales',
  ];

  const gastosHoy = expenses
    .filter((e) => e.type === 'GASTO_OPERATIVO' && e.date.toLowerCase().includes('hoy'))
    .reduce((sum, e) => sum + e.amount, 0);
  const comprasMes = expenses
    .filter((e) => e.type === 'COMPRA_PROVEEDOR')
    .reduce((sum, e) => sum + e.amount, 0);
  const totalEgresos = expenses.reduce((sum, e) => sum + e.amount, 0);

  const filteredExpenses = expenses.filter((e) => {
    const matchesSearch =
      e.beneficiary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.voucherNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat =
      categoryFilter === 'TODAS' || e.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  useEffect(() => {
    async function loadExpenses() {
      let isNew = true;
      let userEmail = '';
      let tenantId = '';

      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem('unisaas_active_session');
          if (stored) {
            const parsed = JSON.parse(stored);
            isNew = Boolean(parsed?.tenant?.isNewStore || parsed?.user?.isNewStore);
            userEmail = parsed?.user?.email || '';
            tenantId = parsed?.tenant?.id || parsed?.user?.tenantId || '';
          }
        } catch {}
      }

      if (isNew || userEmail !== 'owner@demo.com') {
        setExpenses([]);
        return;
      }

      try {
        const res = await fetch('/api/accounting/expenses', {
          headers: tenantId ? { 'x-tenant-id': tenantId } : {},
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setExpenses(data);
            return;
          }
        }
      } catch (err) {
        console.error('Error al cargar gastos desde API:', err);
      }

      setExpenses(DEMO_EXPENSES);
    }

    loadExpenses();
    window.addEventListener('unisaas_store_changed', loadExpenses);
    window.addEventListener('storage', loadExpenses);
    return () => {
      window.removeEventListener('unisaas_store_changed', loadExpenses);
      window.removeEventListener('storage', loadExpenses);
    };
  }, []);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(newAmount) || 0;
    if (!newBeneficiary || val <= 0) return;

    const newExp: ExpenseItem = {
      id: `exp-${Date.now()}`,
      date: 'Hoy, Ahora',
      voucherNumber: newVoucher || `CE-${Math.floor(1000 + Math.random() * 9000)}`,
      type: newType,
      beneficiary: newBeneficiary,
      category: newCategory,
      paymentMethod: newMethod,
      amount: val,
      description: newDescription || 'Sin descripcion adicional',
      registeredBy: 'Administrador (Dueño)',
    };

    try {
      const res = await fetch('/api/accounting/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newExp),
      });
      if (res.ok) {
        const saved = await res.json();
        setExpenses([saved, ...expenses]);
      } else {
        setExpenses([newExp, ...expenses]);
      }
    } catch {
      setExpenses([newExp, ...expenses]);
    }

    setShowCreateModal(false);
    setNewBeneficiary('');
    setNewAmount('');
    setNewVoucher('');
    setNewDescription('');
    alert(`Comprobante de egreso ${newExp.voucherNumber} registrado satisfactoriamente.`);
  };

  return (
    <div className="space-y-6">
      {/* Encabezado y Accion */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Gastos Operativos y Compras
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Registro de egresos de caja menor, pagos de servicios y recepcion de compras a proveedores
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2.5 bg-[#18668F] hover:bg-[#135273] text-white text-xs font-bold rounded-2xl shadow-xs transition-colors flex items-center space-x-1.5 w-fit"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Egreso / Compra</span>
        </button>
      </div>

      {/* 3 Tarjetas de Resumen Financiero */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-100">
          <div className="text-xs font-semibold text-slate-500">Gastos de Caja Menor (Hoy)</div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1 font-mono">
            {formatCOP(gastosHoy)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Salidas directas de gaveta</div>
        </div>

        <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-100">
          <div className="text-xs font-semibold text-slate-500">Compras a Proveedores (Mes)</div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1 font-mono">
            {formatCOP(comprasMes)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Reposicion de materia prima</div>
        </div>

        <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-100">
          <div className="text-xs font-semibold text-slate-500">Total Egresos Registrados</div>
          <div className="text-2xl font-extrabold text-rose-600 mt-1 font-mono">
            {formatCOP(totalEgresos)}
          </div>
          <div className="text-[10px] text-rose-500 mt-0.5">Asentados en contabilidad</div>
        </div>
      </div>

      {/* Filtros y Buscador */}
      <div className="bg-white p-4 rounded-3xl shadow-xs border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por beneficiario, comprobante o descripcion..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 rounded-xl text-xs text-slate-800 border-0 focus:ring-2 focus:ring-[#18668F] focus:outline-none"
          />
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold text-slate-400">Categoria:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-50 border-0 text-xs font-bold text-slate-700 py-2 px-3 rounded-xl focus:ring-2 focus:ring-[#18668F] focus:outline-none"
          >
            <option value="TODAS">Todas las categorias</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabla de Egresos */}
      <div className="bg-white rounded-3xl shadow-xs border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[11px] font-bold text-slate-400 border-b border-slate-100 bg-slate-50/50">
                <th className="py-3 px-5">N° Comprobante</th>
                <th className="py-3 px-4">Fecha y Hora</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Beneficiario / Proveedor</th>
                <th className="py-3 px-4">Categoria</th>
                <th className="py-3 px-4">Medio de Pago</th>
                <th className="py-3 px-4">Registrado Por</th>
                <th className="py-3 px-5 text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="max-w-xs mx-auto space-y-1">
                      <p className="font-bold text-slate-700 text-xs">No hay egresos ni compras registradas</p>
                      <p className="text-[11px] text-slate-400">Registra comprobantes de egreso o compras a proveedores para controlar tus costos operativos.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-5 font-bold font-mono text-slate-900">
                      {exp.voucherNumber}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-medium">{exp.date}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                          exp.type === 'COMPRA_PROVEEDOR'
                            ? 'bg-blue-50 text-[#18668F]'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {exp.type === 'COMPRA_PROVEEDOR' ? 'COMPRA MERCANCIA' : 'GASTO MENOR'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{exp.beneficiary}</div>
                      <div className="text-[10px] text-slate-400 max-w-xs truncate">
                        {exp.description}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-medium">{exp.category}</td>
                    <td className="py-3.5 px-4 text-slate-500 font-medium">
                      {exp.paymentMethod === 'EFECTIVO_CAJA' && 'Efectivo Caja'}
                      {exp.paymentMethod === 'TRANSFERENCIA' && 'Transferencia Bancaria'}
                      {exp.paymentMethod === 'CREDITO_PROVEEDOR' && 'Credito Proveedor'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">{exp.registeredBy}</td>
                    <td className="py-3.5 px-5 text-right font-extrabold font-mono text-slate-900">
                      {formatCOP(exp.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal para Registrar Egreso / Compra */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-sm">
                Registrar Comprobante de Egreso / Compra
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Tipo de Egreso:</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as any)}
                    className="w-full p-2 bg-slate-50 rounded-xl text-slate-800 font-bold border-0 focus:ring-2 focus:ring-[#18668F]"
                  >
                    <option value="GASTO_OPERATIVO">Gasto Caja Menor</option>
                    <option value="COMPRA_PROVEEDOR">Compra a Proveedor</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">N° Comprobante / Factura:</label>
                  <input
                    type="text"
                    placeholder="CE-0046 o Factura"
                    value={newVoucher}
                    onChange={(e) => setNewVoucher(e.target.value)}
                    className="w-full p-2 bg-slate-50 rounded-xl text-slate-800 font-mono border-0 focus:ring-2 focus:ring-[#18668F]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Beneficiario / Proveedor:</label>
                <input
                  type="text"
                  required
                  placeholder="Nombre de la empresa o persona que recibe el dinero"
                  value={newBeneficiary}
                  onChange={(e) => setNewBeneficiary(e.target.value)}
                  className="w-full p-2 bg-slate-50 rounded-xl text-slate-800 border-0 focus:ring-2 focus:ring-[#18668F]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Categoria de Gasto:</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full p-2 bg-slate-50 rounded-xl text-slate-800 border-0 focus:ring-2 focus:ring-[#18668F]"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Medio de Pago:</label>
                  <select
                    value={newMethod}
                    onChange={(e) => setNewMethod(e.target.value as any)}
                    className="w-full p-2 bg-slate-50 rounded-xl text-slate-800 border-0 focus:ring-2 focus:ring-[#18668F]"
                  >
                    <option value="EFECTIVO_CAJA">Efectivo (Gaveta Caja)</option>
                    <option value="TRANSFERENCIA">Transferencia Bancaria</option>
                    <option value="CREDITO_PROVEEDOR">Credito Proveedor</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Monto Pagado ($ COP):</label>
                <input
                  type="number"
                  required
                  placeholder="0"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  className="w-full p-2 bg-slate-50 rounded-xl text-slate-900 font-mono font-extrabold text-sm border-0 focus:ring-2 focus:ring-[#18668F]"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Concepto / Descripcion:</label>
                <textarea
                  rows={2}
                  placeholder="Detalle especifico del egreso..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full p-2 bg-slate-50 rounded-xl text-slate-800 border-0 focus:ring-2 focus:ring-[#18668F]"
                />
              </div>

              <div className="flex items-center space-x-2 pt-3">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#18668F] hover:bg-[#135273] text-white font-bold text-xs rounded-xl"
                >
                  Asentar Egreso
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
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

