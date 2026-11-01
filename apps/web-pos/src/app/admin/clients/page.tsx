'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  CreditCard,
  DollarSign,
  AlertTriangle,
  Receipt,
  Phone,
  MapPin,
  X,
  History,
  CheckCircle2,
} from 'lucide-react';
import { formatCOP } from '@/lib/currency';

interface Customer {
  id: string;
  documentType: string;
  documentNumber: string;
  name: string;
  tradeName?: string;
  phone: string;
  city: string;
  creditLimit: number;
  creditBalance: number;
  availableCredit: number;
  hasOverdueCredits: boolean;
}

const DEMO_CUSTOMERS: Customer[] = [
  {
    id: 'cust-1',
    documentType: 'NIT',
    documentNumber: '900.000.000-1',
    name: 'Comercializadora Demo SAS',
    tradeName: 'Comercio Demo Central',
    phone: '300 111 2233',
    city: 'Ciudad Demo',
    creditLimit: 3000000,
    creditBalance: 820000,
    availableCredit: 2180000,
    hasOverdueCredits: false,
  },
  {
    id: 'cust-2',
    documentType: 'CC',
    documentNumber: '1.000.000.001',
    name: 'Cliente Demo 01',
    tradeName: 'Inversiones Demo',
    phone: '300 222 3344',
    city: 'Ciudad Demo',
    creditLimit: 1000000,
    creditBalance: 245000,
    availableCredit: 755000,
    hasOverdueCredits: false,
  },
  {
    id: 'cust-3',
    documentType: 'CC',
    documentNumber: '1.000.000.002',
    name: 'Cliente Demo 02',
    phone: '300 333 4455',
    city: 'Ciudad Demo',
    creditLimit: 800000,
    creditBalance: 0,
    availableCredit: 800000,
    hasOverdueCredits: false,
  },
  {
    id: 'cust-4',
    documentType: 'CC',
    documentNumber: '1.000.000.003',
    name: 'Cliente Demo Mora',
    phone: '300 444 5566',
    city: 'Ciudad Demo',
    creditLimit: 500000,
    creditBalance: 415000,
    availableCredit: 85000,
    hasOverdueCredits: true,
  },
];

export default function AdminClientsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedCustomerForHistory, setSelectedCustomerForHistory] = useState<Customer | null>(null);

  const [newCustDocType, setNewCustDocType] = useState('CC');
  const [newCustDocNumber, setNewCustDocNumber] = useState('');
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustCity, setNewCustCity] = useState('Mocoa');
  const [newCustLimit, setNewCustLimit] = useState('500000');

  const [selectedCustomerIdForPay, setSelectedCustomerIdForPay] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('EFECTIVO');

  const [customers, setCustomers] = useState<Customer[]>([]);

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.documentNumber.includes(searchQuery) ||
      c.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalCartera = customers.reduce((sum, c) => sum + c.creditBalance, 0);
  const clientesConMora = customers.filter((c) => c.hasOverdueCredits).length;

  useEffect(() => {
    async function loadCustomers() {
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
            tenantId = parsed?.user?.tenantId || parsed?.tenant?.id || '';
          }
        } catch {}
      }

      if (userEmail === 'owner@demo.com' && !isNew) {
        setCustomers(DEMO_CUSTOMERS);
      } else {
        setCustomers([]);
      }

      try {
        const headers: Record<string, string> = {};
        if (tenantId) headers['x-tenant-id'] = tenantId;
        const res = await fetch('/api/credits/customers', { headers });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            if (isNew || (userEmail && userEmail !== 'owner@demo.com')) {
              setCustomers(data);
            } else if (data.length > 0) {
              setCustomers(data);
            }
          }
        }
      } catch (err) {
        console.error('Error al cargar clientes desde API:', err);
      }
    }

    loadCustomers();
    window.addEventListener('unisaas_store_changed', loadCustomers);
    window.addEventListener('storage', loadCustomers);
    return () => {
      window.removeEventListener('unisaas_store_changed', loadCustomers);
      window.removeEventListener('storage', loadCustomers);
    };
  }, []);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName || !newCustDocNumber) return;

    const limit = parseFloat(newCustLimit) || 0;
    const newCustomer: Customer = {
      id: `cust-${Date.now()}`,
      documentType: newCustDocType,
      documentNumber: newCustDocNumber,
      name: newCustName,
      phone: newCustPhone,
      city: newCustCity,
      creditLimit: limit,
      creditBalance: 0,
      availableCredit: limit,
      hasOverdueCredits: false,
    };

    try {
      const res = await fetch('/api/credits/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCustomer),
      });
      if (res.ok) {
        const saved = await res.json();
        setCustomers([saved, ...customers]);
      } else {
        setCustomers([newCustomer, ...customers]);
      }
    } catch {
      setCustomers([newCustomer, ...customers]);
    }

    setShowCreateModal(false);
    setNewCustName('');
    setNewCustDocNumber('');
    alert(`Cliente ${newCustomer.name} registrado con exito.`);
  };

  const handleApplyPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(paymentAmount) || 0;
    if (!selectedCustomerIdForPay || amount <= 0) return;

    try {
      await fetch(`/api/credits/customers/${encodeURIComponent(selectedCustomerIdForPay)}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
    } catch (err) {
      console.error('Error al registrar abono en API:', err);
    }

    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === selectedCustomerIdForPay) {
          const newBal = Math.max(0, c.creditBalance - amount);
          return {
            ...c,
            creditBalance: newBal,
            availableCredit: c.creditLimit - newBal,
            hasOverdueCredits: newBal === 0 ? false : c.hasOverdueCredits,
          };
        }
        return c;
      })
    );

    alert(`Abono por ${formatCOP(amount)} registrado. Se genero Recibo de Caja RCG-${Math.floor(1000 + Math.random() * 9000)}.`);
    setShowPaymentModal(false);
    setPaymentAmount('');
    setSelectedCustomerIdForPay('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Clientes y Cartera (Fiado)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Administracion de cupos de credito, cobro de cuentas pendientes y registro de abonos
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setShowPaymentModal(true)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-2xl shadow-xs transition-colors"
          >
            <span>Registrar Abono</span>
          </button>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 bg-[#18668F] hover:bg-[#135273] text-white text-xs font-bold rounded-2xl shadow-xs transition-colors flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Cliente</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-100">
          <div className="text-xs font-semibold text-slate-500">Cartera Activa por Cobrar</div>
          <div className="text-2xl font-extrabold text-[#18668F] mt-1 font-mono">
            {formatCOP(totalCartera)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Saldo pendiente de pago</div>
        </div>

        <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-100">
          <div className="text-xs font-semibold text-slate-500">Clientes Registrados</div>
          <div className="text-2xl font-extrabold text-slate-900 mt-1 font-mono">
            {customers.length}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Con cupo comercial autorizado</div>
        </div>

        <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-100">
          <div className="text-xs font-semibold text-slate-500">Clientes en Mora</div>
          <div className="text-2xl font-extrabold text-rose-600 mt-1 font-mono">
            {clientesConMora}
          </div>
          <div className="text-[10px] text-rose-500 mt-0.5">Bloqueados temporalmente para fiado</div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-3xl shadow-xs border border-slate-100 flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nombre, NIT, cedula o ciudad..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 rounded-xl text-xs text-slate-800 border-0 focus:ring-2 focus:ring-[#18668F] focus:outline-none"
          />
        </div>
        <div className="text-xs text-slate-400 font-medium">
          {filteredCustomers.length} clientes encontrados
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-xs border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[11px] font-bold text-slate-400 border-b border-slate-100 bg-slate-50/50">
                <th className="py-3 px-5">Documento</th>
                <th className="py-3 px-4">Cliente / Razon Social</th>
                <th className="py-3 px-4">Contacto</th>
                <th className="py-3 px-4 text-right">Cupo Autorizado</th>
                <th className="py-3 px-4 text-right">Deuda Actual</th>
                <th className="py-3 px-4 text-right">Cupo Disponible</th>
                <th className="py-3 px-4 text-center">Estado Cartera</th>
                <th className="py-3 px-5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="max-w-xs mx-auto space-y-1">
                      <p className="font-bold text-slate-700 text-xs">No hay clientes registrados</p>
                      <p className="text-[11px] text-slate-400">Registra clientes para habilitar compras a credito (fiado) o control comercial de cartera.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((cust) => (
                  <tr key={cust.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-5 font-mono font-bold text-slate-800">
                      {cust.documentType}: {cust.documentNumber}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{cust.name}</div>
                      {cust.tradeName && (
                        <div className="text-[10px] text-slate-400">{cust.tradeName}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      <div>{cust.phone}</div>
                      <div className="text-[10px] text-slate-400">{cust.city}</div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-700">
                      {formatCOP(cust.creditLimit)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                      <span className={cust.creditBalance > 0 ? 'text-amber-700' : 'text-slate-400'}>
                        {formatCOP(cust.creditBalance)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600">
                      {formatCOP(cust.availableCredit)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`text-[10px] font-extrabold tracking-wider px-2.5 py-1 rounded-full ${
                          cust.hasOverdueCredits
                            ? 'text-rose-600 bg-rose-50'
                            : cust.creditBalance > 0
                            ? 'text-amber-700 bg-amber-50'
                            : 'text-emerald-600 bg-emerald-50'
                        }`}
                      >
                        {cust.hasOverdueCredits ? 'EN MORA' : cust.creditBalance > 0 ? 'CON SALDO' : 'AL DIA'}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="inline-flex items-center space-x-1">
                        {cust.creditBalance > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCustomerIdForPay(cust.id);
                              setShowPaymentModal(true);
                            }}
                            className="px-2 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Registrar Abono"
                          >
                            Abonar
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedCustomerForHistory(cust)}
                          className="px-2 py-1 text-xs font-bold text-[#18668F] hover:bg-blue-50 rounded-lg transition-colors"
                          title="Ver Historial"
                        >
                          Historial
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-sm">
                Registrar Nuevo Cliente
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Tipo:</label>
                  <select
                    value={newCustDocType}
                    onChange={(e) => setNewCustDocType(e.target.value)}
                    className="w-full p-2 bg-slate-50 rounded-xl text-slate-800 border-0 focus:ring-2 focus:ring-[#18668F]"
                  >
                    <option value="CC">CC</option>
                    <option value="NIT">NIT</option>
                    <option value="CE">CE</option>
                    <option value="PP">Pasaporte</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-slate-700 font-bold mb-1">Numero de Documento:</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. 1.122.334.455"
                    value={newCustDocNumber}
                    onChange={(e) => setNewCustDocNumber(e.target.value)}
                    className="w-full p-2 bg-slate-50 rounded-xl text-slate-800 border-0 focus:ring-2 focus:ring-[#18668F]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Nombre Completo o Razon Social:</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Juan Perez o Comercializadora SAS"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  className="w-full p-2 bg-slate-50 rounded-xl text-slate-800 border-0 focus:ring-2 focus:ring-[#18668F]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Telefono / Celular:</label>
                  <input
                    type="text"
                    placeholder="Ej. 312 456 7890"
                    value={newCustPhone}
                    onChange={(e) => setNewCustPhone(e.target.value)}
                    className="w-full p-2 bg-slate-50 rounded-xl text-slate-800 border-0 focus:ring-2 focus:ring-[#18668F]"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Ciudad:</label>
                  <input
                    type="text"
                    placeholder="Mocoa"
                    value={newCustCity}
                    onChange={(e) => setNewCustCity(e.target.value)}
                    className="w-full p-2 bg-slate-50 rounded-xl text-slate-800 border-0 focus:ring-2 focus:ring-[#18668F]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Cupo de Credito Autorizado ($ COP):</label>
                <input
                  type="number"
                  placeholder="Ej. 500000"
                  value={newCustLimit}
                  onChange={(e) => setNewCustLimit(e.target.value)}
                  className="w-full p-2 bg-slate-50 rounded-xl text-slate-800 font-mono font-bold border-0 focus:ring-2 focus:ring-[#18668F]"
                />
              </div>

              <div className="flex items-center space-x-2 pt-3">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#18668F] hover:bg-[#135273] text-white font-bold text-xs rounded-xl"
                >
                  Guardar Cliente
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

      {showPaymentModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-sm">
                Registrar Abono a Cuenta por Cobrar (Fiado)
              </h3>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleApplyPayment} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Seleccionar Cliente:</label>
                <select
                  required
                  value={selectedCustomerIdForPay}
                  onChange={(e) => setSelectedCustomerIdForPay(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 rounded-xl text-slate-800 font-bold border-0 focus:ring-2 focus:ring-[#18668F]"
                >
                  <option value="">Seleccione un cliente...</option>
                  {customers
                    .filter((c) => c.creditBalance > 0)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} - Deuda: {formatCOP(c.creditBalance)}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Monto del Abono ($ COP):</label>
                <input
                  type="number"
                  required
                  placeholder="0"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 rounded-xl text-slate-900 font-mono font-extrabold text-sm border-0 focus:ring-2 focus:ring-[#18668F]"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Medio de Pago:</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 rounded-xl text-slate-800 font-medium border-0 focus:ring-2 focus:ring-[#18668F]"
                >
                  <option value="EFECTIVO">Efectivo en Caja</option>
                  <option value="TRANSFERENCIA">Transferencia / Bancolombia / Nequi</option>
                  <option value="DATAFONO">Tarjeta / Datafono</option>
                </select>
              </div>

              <div className="flex items-center space-x-2 pt-3">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl"
                >
                  Confirmar Abono y Emitir Recibo
                </button>
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedCustomerForHistory && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">
                  Historial de Cartera: {selectedCustomerForHistory.name}
                </h3>
                <p className="text-[10px] text-slate-400">
                  {selectedCustomerForHistory.documentType} {selectedCustomerForHistory.documentNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomerForHistory(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400">Cupo Total:</span>
                <div className="font-mono font-bold text-slate-900">
                  {formatCOP(selectedCustomerForHistory.creditLimit)}
                </div>
              </div>
              <div className="p-3 bg-blue-50 text-blue-900 rounded-xl">
                <span className="text-blue-700">Saldo Pendiente:</span>
                <div className="font-mono font-extrabold text-[#18668F]">
                  {formatCOP(selectedCustomerForHistory.creditBalance)}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Ultimos Movimientos
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                <div className="py-2 flex justify-between items-center">
                  <div>
                    <div className="font-bold text-slate-800">Compra a Credito (Fiado)</div>
                    <div className="text-[10px] text-slate-400">Hoy, 01:15 PM - Factura POS-004490</div>
                  </div>
                  <span className="font-mono font-bold text-rose-600">+ $ 148.100</span>
                </div>
                <div className="py-2 flex justify-between items-center">
                  <div>
                    <div className="font-bold text-slate-800">Abono a Cuenta en Efectivo</div>
                    <div className="text-[10px] text-slate-400">14 Oct 2026 - Recibo RCG-0012</div>
                  </div>
                  <span className="font-mono font-bold text-emerald-600">- $ 180.000</span>
                </div>
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                type="button"
                onClick={() => setSelectedCustomerForHistory(null)}
                className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

