'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Download,
  Plus,
  Calendar,
  Wallet,
  Receipt,
  Users,
  Store,
  X,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  Eye,
  EyeOff,
  Calculator,
} from 'lucide-react';
import { formatCOP, COLOMBIAN_DENOMINATIONS, calculateCashTotal } from '@/lib/currency';

interface Movement {
  id: string;
  date: string;
  type: 'INGRESO' | 'EGRESO' | 'INGRESO_CARTERA' | 'EGRESO_COMPRA';
  category: string;
  concept: string;
  documentNumber: string;
  paymentMethod: string;
  amount: number;
  runningBalance: number;
}

interface BalanceSummary {
  totalVentas: number;
  totalGastos: number;
  totalCompras: number;
  netoOperativo: number;
  carteraCobrar: number;
  cuentasPagar: number;
  efectivoCajaActual: number;
  bancosActual: number;
}

export interface CashClosureItem {
  id: string;
  closedAt: string;
  openedAt: string;
  cashierName: string;
  registerNumber: string;
  initialCash: number;
  cashSales: number;
  electronicSales: number;
  expectedCash: number;
  actualCash: number;
  difference: number;
  status: 'CUADRADO' | 'SOBRANTE' | 'FALTANTE';
  notes?: string;
}

const ZERO_SUMMARY: BalanceSummary = {
  totalVentas: 0,
  totalGastos: 0,
  totalCompras: 0,
  netoOperativo: 0,
  carteraCobrar: 0,
  cuentasPagar: 0,
  efectivoCajaActual: 0,
  bancosActual: 0,
};

const DEMO_SUMMARY: BalanceSummary = {
  totalVentas: 25400000,
  totalGastos: 2150000,
  totalCompras: 12800000,
  netoOperativo: 10450000,
  carteraCobrar: 1480000,
  cuentasPagar: 3200000,
  efectivoCajaActual: 385000,
  bancosActual: 10450000,
};

const DEMO_CLOSURES: CashClosureItem[] = [
  {
    id: 'cls-001',
    closedAt: 'Ayer, 08:30 PM',
    openedAt: 'Ayer, 08:00 AM',
    cashierName: 'Sofia Rodriguez',
    registerNumber: 'CAJA-01',
    initialCash: 100000,
    cashSales: 750000,
    electronicSales: 420000,
    expectedCash: 850000,
    actualCash: 850000,
    difference: 0,
    status: 'CUADRADO',
    notes: 'Turno entregado sin novedad en mostrador',
  },
  {
    id: 'cls-002',
    closedAt: '15 Oct 2026, 08:15 PM',
    openedAt: '15 Oct 2026, 08:00 AM',
    cashierName: 'Carlos Moncayo',
    registerNumber: 'CAJA-01',
    initialCash: 100000,
    cashSales: 920000,
    electronicSales: 510000,
    expectedCash: 1020000,
    actualCash: 1015000,
    difference: -5000,
    status: 'FALTANTE',
    notes: 'Faltaron $5.000 por redondeo y vuelto a cliente',
  },
  {
    id: 'cls-003',
    closedAt: '14 Oct 2026, 08:00 PM',
    openedAt: '14 Oct 2026, 08:00 AM',
    cashierName: 'Sofia Rodriguez',
    registerNumber: 'CAJA-01',
    initialCash: 100000,
    cashSales: 630000,
    electronicSales: 380000,
    expectedCash: 730000,
    actualCash: 732000,
    difference: 2000,
    status: 'SOBRANTE',
    notes: 'Sobrante por ajuste de cambio exacto',
  },
];

const DEMO_MOVEMENTS: Movement[] = [
  {
    id: 'mov-1',
    date: 'Hoy, 02:45 PM',
    type: 'INGRESO',
    category: 'Venta Mostrador POS',
    concept: 'Factura POS-004491 - Venta mostrador',
    documentNumber: 'POS-004491',
    paymentMethod: 'EFECTIVO',
    amount: 185000,
    runningBalance: 2450000,
  },
  {
    id: 'mov-2',
    date: 'Hoy, 01:15 PM',
    type: 'INGRESO_CARTERA',
    category: 'Abono de Cliente (Fiado)',
    concept: 'Recibo RCG-4490 - Comercializadora Demo SAS',
    documentNumber: 'RCG-4490',
    paymentMethod: 'TRANSFERENCIA',
    amount: 150000,
    runningBalance: 2265000,
  },
  {
    id: 'mov-3',
    date: 'Hoy, 10:30 AM',
    type: 'EGRESO',
    category: 'Gasto Operativo Caja',
    concept: 'Comprobante CE-0045 - Supermercado Demo (Insumos)',
    documentNumber: 'CE-0045',
    paymentMethod: 'EFECTIVO_CAJA',
    amount: -45000,
    runningBalance: 2115000,
  },
  {
    id: 'mov-4',
    date: 'Ayer, 04:30 PM',
    type: 'EGRESO_COMPRA',
    category: 'Compra Proveedor',
    concept: 'Factura FP-9821 - Proveedor Carnes Demo S.A.S.',
    documentNumber: 'FP-9821',
    paymentMethod: 'TRANSFERENCIA',
    amount: -1450000,
    runningBalance: 2160000,
  },
  {
    id: 'mov-5',
    date: 'Ayer, 02:00 PM',
    type: 'INGRESO',
    category: 'Venta Mostrador POS',
    concept: 'Factura POS-004489 - Venta mostrador',
    documentNumber: 'POS-004489',
    paymentMethod: 'DATAFONO_TARJETA',
    amount: 320000,
    runningBalance: 3610000,
  },
  {
    id: 'mov-6',
    date: '15 Oct 2026',
    type: 'EGRESO',
    category: 'Servicios Publicos',
    concept: 'Comprobante CE-0044 - Factura de energia electrica',
    documentNumber: 'CE-0044',
    paymentMethod: 'TRANSFERENCIA',
    amount: -280000,
    runningBalance: 3290000,
  },
];

export default function AdminBalancePage() {
  const [activeMainTab, setActiveMainTab] = useState<'balance' | 'cierres'>('balance');
  const [period, setPeriod] = useState('ESTE_MES');
  const [filterType, setFilterType] = useState('TODOS');
  const [showNewMovementModal, setShowNewMovementModal] = useState(false);

  const [isShiftOpen, setIsShiftOpen] = useState(false);
  const [activeShiftId, setActiveShiftId] = useState<string | null>(null);
  const [sessionUserName, setSessionUserName] = useState('Administrador');
  const [currentShiftData, setCurrentShiftData] = useState({
    cashierName: 'Administrador',
    registerNumber: 'CAJA-01',
    openedAt: '--',
    initialCash: 0,
    cashSales: 0,
    electronicSales: 0,
    expectedCash: 0,
  });

  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);

  const [openInitialCash, setOpenInitialCash] = useState('100000');
  const [openDenomCounts, setOpenDenomCounts] = useState<Record<number, number>>({});
  const [showOpenCalc, setShowOpenCalc] = useState(false);

  const [closeActualCash, setCloseActualCash] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [closeDenomCounts, setCloseDenomCounts] = useState<Record<number, number>>({});
  const [blindCountMode, setBlindCountMode] = useState(true);
  const [revealBlindCount, setRevealBlindCount] = useState(false);

  const [availableEmployees, setAvailableEmployees] = useState<string[]>([
    'Administrador (Propietario)',
  ]);

  const [closures, setClosures] = useState<CashClosureItem[]>([]);

  const [movType, setMovType] = useState<'INGRESO' | 'EGRESO'>('EGRESO');
  const [movCategory, setMovCategory] = useState('Gasto de Caja Menor');
  const [movAmount, setMovAmount] = useState('');
  const [movConcept, setMovConcept] = useState('');
  const [movPaymentMethod, setMovPaymentMethod] = useState('EFECTIVO');

  const [summary, setSummary] = useState<BalanceSummary>(ZERO_SUMMARY);

  const [movements, setMovements] = useState<Movement[]>([]);

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const checkAndLoad = async () => {
      try {
        const meRes = await fetch('/api/auth/me', { cache: 'no-store' });
        if (!meRes.ok) {
          window.location.href = '/login';
          return;
        }
        const me = await meRes.json();
        if (cancelled) return;

        const isDemo = me.email === 'owner@demo.com';
        const name = me.fullName || me.name || me.username || 'Administrador';
        setSessionUserName(name);
        setCurrentShiftData((prev) => ({ ...prev, cashierName: name }));

        const [balRes, teamRes, shiftsRes] = await Promise.all([
          fetch('/api/accounting/balance', { cache: 'no-store' }),
          fetch('/api/admin/team', { cache: 'no-store' }),
          fetch('/api/pos/shifts', { cache: 'no-store' }),
        ]);

        if (balRes.ok) {
          const data = await balRes.json();
          if (data.summary) setSummary(data.summary);
          if (Array.isArray(data.movements)) {
            setMovements(data.movements);
          }
        }

        if (teamRes.ok) {
          const teamData = await teamRes.json();
          if (teamData.team && Array.isArray(teamData.team)) {
            const names = teamData.team.map((m: any) => `${m.name} (${m.roleCode})`);
            if (names.length > 0) {
              setAvailableEmployees(names);
            }
          }
        }

        if (shiftsRes.ok) {
          const shiftData = await shiftsRes.json();
          if (shiftData.activeShift) {
            setIsShiftOpen(true);
            setActiveShiftId(shiftData.activeShift.id);
            setCurrentShiftData({
              cashierName: shiftData.activeShift.cashierName || name,
              registerNumber: shiftData.activeShift.registerNumber || 'CAJA-01',
              openedAt: shiftData.activeShift.openingTime,
              initialCash: shiftData.activeShift.initialCash,
              cashSales: shiftData.activeShift.cashSalesTotal,
              electronicSales: shiftData.activeShift.electronicSalesTotal,
              expectedCash: shiftData.activeShift.expectedCash,
            });
          }
          if (Array.isArray(shiftData.recentShifts)) {
            const closed = shiftData.recentShifts
              .filter((s: any) => s.status === 'CLOSED')
              .map((s: any) => ({
                id: s.id,
                closedAt: s.closingTime || 'Cerrado',
                openedAt: s.openingTime,
                cashierName: s.cashierName,
                registerNumber: s.registerNumber,
                initialCash: s.initialCash,
                cashSales: s.cashSalesTotal,
                electronicSales: s.electronicSalesTotal,
                expectedCash: s.expectedCash,
                actualCash: s.actualCash || 0,
                difference: s.difference || 0,
                status: s.difference === 0 ? 'CUADRADO' : (s.difference || 0) > 0 ? 'SOBRANTE' : 'FALTANTE',
                notes: s.notes || 'Turno entregado sin novedad en mostrador',
              }));
            if (closed.length > 0) {
              setClosures(closed);
            }
          }
        }

        if (isDemo && me.tenant?.id === 'tenant-demo-empresa-01' && !me.tenant?.isNewStore) {
          setIsShiftOpen(true);
          setCurrentShiftData({
            cashierName: 'Carlos Moncayo',
            registerNumber: 'CAJA-01',
            openedAt: 'Hoy, 07:30 AM',
            initialCash: 100000,
            cashSales: 185000,
            electronicSales: 320000,
            expectedCash: 285000,
          });
          setClosures(DEMO_CLOSURES);
          setSummary(DEMO_SUMMARY);
          setMovements(DEMO_MOVEMENTS);
        }
      } catch (err) {
        console.error('Error al cargar datos de balance:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    checkAndLoad();
    window.addEventListener('storage', checkAndLoad);
    window.addEventListener('unisaas_store_changed', checkAndLoad);

    return () => {
      cancelled = true;
      window.removeEventListener('storage', checkAndLoad);
      window.removeEventListener('unisaas_store_changed', checkAndLoad);
    };
  }, []);

  const handleOpenShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const base = parseFloat(openInitialCash) || 100000;
    try {
      const res = await fetch('/api/pos/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initialCash: base,
          registerNumber: 'CAJA-01',
          cashierName: sessionUserName,
          denominations: Object.entries(openDenomCounts).map(([denom, qty]) => ({
            denomination: Number(denom),
            quantity: Number(qty) || 0,
            total: Number(denom) * (Number(qty) || 0),
          })),
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setActiveShiftId(created.id);
        setCurrentShiftData({
          cashierName: created.cashierName,
          registerNumber: created.registerNumber,
          openedAt: created.openingTime,
          initialCash: created.initialCash,
          cashSales: 0,
          electronicSales: 0,
          expectedCash: created.expectedCash,
        });
      } else {
        setCurrentShiftData({
          cashierName: sessionUserName,
          registerNumber: 'CAJA-01',
          openedAt: 'Hoy, Ahora',
          initialCash: base,
          cashSales: 0,
          electronicSales: 0,
          expectedCash: base,
        });
      }
    } catch {
      setCurrentShiftData({
        cashierName: sessionUserName,
        registerNumber: 'CAJA-01',
        openedAt: 'Hoy, Ahora',
        initialCash: base,
        cashSales: 0,
        electronicSales: 0,
        expectedCash: base,
      });
    }

    setIsShiftOpen(true);
    setShowOpenShiftModal(false);
  };

  const handleCloseShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const actual = parseFloat(closeActualCash) || 0;
    const expected = currentShiftData.expectedCash;
    const diff = actual - expected;
    const status: 'CUADRADO' | 'SOBRANTE' | 'FALTANTE' =
      diff === 0 ? 'CUADRADO' : diff > 0 ? 'SOBRANTE' : 'FALTANTE';

    if (diff !== 0 && !closeNotes.trim()) {
      alert('Por favor ingrese una nota aclaratoria explicando el motivo del descuadre en caja.');
      return;
    }

    try {
      const res = await fetch('/api/pos/shifts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftId: activeShiftId,
          totalActualCash: actual,
          denominations: Object.entries(closeDenomCounts).map(([denom, qty]) => ({
            denomination: Number(denom),
            quantity: Number(qty) || 0,
            total: Number(denom) * (Number(qty) || 0),
          })),
          notes: closeNotes.trim() || 'Turno entregado sin novedad en mostrador',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const rep = data.reportZ || {};
        const newClosure: CashClosureItem = {
          id: rep.consecutive || `cls-${Date.now()}`,
          closedAt: rep.timestamp || 'Hoy, Ahora',
          openedAt: currentShiftData.openedAt,
          cashierName: rep.cashierName || sessionUserName,
          registerNumber: rep.registerNumber || currentShiftData.registerNumber,
          initialCash: rep.initialCash ?? currentShiftData.initialCash,
          cashSales: rep.cashSalesTotal ?? currentShiftData.cashSales,
          electronicSales: rep.electronicSalesTotal ?? currentShiftData.electronicSales,
          expectedCash: rep.expectedCash ?? expected,
          actualCash: rep.actualCash ?? actual,
          difference: rep.difference ?? diff,
          status: rep.auditedStatus || status,
          notes: closeNotes.trim() || 'Turno entregado sin novedad en mostrador',
        };
        setClosures([newClosure, ...closures]);
      } else {
        const fallbackClosure: CashClosureItem = {
          id: `cls-${Date.now()}`,
          closedAt: 'Hoy, Ahora',
          openedAt: currentShiftData.openedAt,
          cashierName: sessionUserName,
          registerNumber: currentShiftData.registerNumber,
          initialCash: currentShiftData.initialCash,
          cashSales: currentShiftData.cashSales,
          electronicSales: currentShiftData.electronicSales,
          expectedCash: expected,
          actualCash: actual,
          difference: diff,
          status,
          notes: closeNotes.trim() || 'Turno entregado sin novedad en mostrador',
        };
        setClosures([fallbackClosure, ...closures]);
      }
    } catch {
      const fallbackClosure: CashClosureItem = {
        id: `cls-${Date.now()}`,
        closedAt: 'Hoy, Ahora',
        openedAt: currentShiftData.openedAt,
        cashierName: sessionUserName,
        registerNumber: currentShiftData.registerNumber,
        initialCash: currentShiftData.initialCash,
        cashSales: currentShiftData.cashSales,
        electronicSales: currentShiftData.electronicSales,
        expectedCash: expected,
        actualCash: actual,
        difference: diff,
        status,
        notes: closeNotes.trim() || 'Turno entregado sin novedad en mostrador',
      };
      setClosures([fallbackClosure, ...closures]);
    }

    setIsShiftOpen(false);
    setShowCloseShiftModal(false);
    setCloseActualCash('');
    setCloseNotes('');
    setCloseDenomCounts({});
    setRevealBlindCount(false);
  };

  const filteredMovements = movements.filter((m) => {
    if (filterType === 'TODOS') return true;
    if (filterType === 'INGRESOS') return m.amount > 0;
    if (filterType === 'EGRESOS') return m.amount < 0;
    if (filterType === 'VENTAS') return m.type === 'INGRESO';
    if (filterType === 'CARTERA') return m.type === 'INGRESO_CARTERA';
    return true;
  });

  const handleExportBalanceCsv = () => {
    const headers = 'Fecha,Tipo,Categoria,Concepto,Documento,Medio_Pago,Monto_COP,Saldo_Acumulado_COP';
    const rows = movements.map(
      (m) =>
        `"${m.date}","${m.type}","${m.category}","${m.concept}","${m.documentNumber}","${m.paymentMethod}",${m.amount},${m.runningBalance}`
    );
    const csvContent = `\uFEFF${headers}\n${rows.join('\n')}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `balance_operativo_${period.toLowerCase()}_unisaas.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCreateMovement = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(movAmount) || 0;
    if (!movConcept || val <= 0) return;

    const finalAmount = movType === 'EGRESO' ? -val : val;
    const lastBalance = movements[0]?.runningBalance || 0;
    const newRunning = lastBalance + finalAmount;

    const newMov: Movement = {
      id: `mov-${Date.now()}`,
      date: 'Hoy, Ahora',
      type: movType,
      category: movCategory,
      concept: movConcept,
      documentNumber: `MV-${Math.floor(1000 + Math.random() * 9000)}`,
      paymentMethod: movPaymentMethod,
      amount: finalAmount,
      runningBalance: newRunning,
    };

    setMovements([newMov, ...movements]);
    setShowNewMovementModal(false);
    setMovConcept('');
    setMovAmount('');
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-slate-100 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="h-24 bg-slate-100 rounded-xl animate-pulse" />
          <div className="h-24 bg-slate-100 rounded-xl animate-pulse" />
          <div className="h-24 bg-slate-100 rounded-xl animate-pulse" />
          <div className="h-24 bg-slate-100 rounded-xl animate-pulse" />
        </div>
        <div className="h-64 bg-slate-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Balance Operativo del Negocio
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Consolidado en tiempo real de ingresos por ventas, egresos operacionales, compras y flujo de caja
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="bg-white px-3 py-2 rounded-2xl border border-slate-200 shadow-xs text-xs">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="bg-transparent border-0 font-bold text-slate-800 focus:outline-none"
            >
              <option value="HOY">Jornada de Hoy</option>
              <option value="ESTA_SEMANA">Esta Semana</option>
              <option value="ESTE_MES">Este Mes (Octubre 2026)</option>
              <option value="ANIO_2026">Ano Fiscal 2026</option>
            </select>
          </div>
          <button
            type="button"
            onClick={handleExportBalanceCsv}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-2xl shadow-xs transition-colors flex items-center space-x-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>
          <button
            type="button"
            onClick={() => setShowNewMovementModal(true)}
            className="px-4 py-2 bg-[#18668F] hover:bg-[#135273] text-white text-xs font-bold rounded-2xl shadow-xs transition-colors flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Movimiento</span>
          </button>
        </div>
      </div>

      <div className="flex items-center space-x-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveMainTab('balance')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition-colors ${
            activeMainTab === 'balance'
              ? 'border-[#18668F] text-[#18668F]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Flujo de Caja y Balance General
        </button>
        <button
          type="button"
          onClick={() => setActiveMainTab('cierres')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition-colors ${
            activeMainTab === 'cierres'
              ? 'border-[#18668F] text-[#18668F]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Cierres de Caja (Historial de Turnos)
        </button>
      </div>

      {activeMainTab === 'balance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-100 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Ventas Totales</span>
                <div className="p-2 rounded-2xl bg-emerald-50 text-emerald-600">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-extrabold text-slate-900 font-mono-tabular">
                  {formatCOP(summary.totalVentas)}
                </div>
                <div className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center space-x-1">
                  <ArrowUpRight className="w-3 h-3" />
                  <span>Ingresos por mostrador y facturacion</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-100 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Gastos y Compras</span>
                <div className="p-2 rounded-2xl bg-rose-50 text-rose-600">
                  <TrendingDown className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-extrabold text-rose-600 font-mono-tabular">
                  - {formatCOP(summary.totalGastos + summary.totalCompras)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Gastos: {formatCOP(summary.totalGastos)} | Compras: {formatCOP(summary.totalCompras)}
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-100 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Neto Operativo</span>
                <div className="p-2 rounded-2xl bg-blue-50 text-[#18668F]">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-extrabold text-[#18668F] font-mono-tabular">
                  {formatCOP(summary.netoOperativo)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Margen bruto operacional estimado
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-100 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Cartera Fiado Activa</span>
                <div className="p-2 rounded-2xl bg-amber-50 text-amber-600">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-extrabold text-amber-600 font-mono-tabular">
                  {formatCOP(summary.carteraCobrar)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Cuentas por cobrar en gestion
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-xs border border-slate-100 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                  Libro Auxiliar de Movimientos
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Auditoria cronologica de ingresos, egresos y abonos operacionales
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-400 font-semibold">Filtrar por:</span>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 px-3 py-1.5 rounded-xl focus:outline-none"
                >
                  <option value="TODOS">Todos los Movimientos</option>
                  <option value="INGRESOS">Solo Ingresos (+)</option>
                  <option value="EGRESOS">Solo Egresos (-)</option>
                  <option value="VENTAS">Ventas POS</option>
                  <option value="CARTERA">Abonos de Cartera</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[11px] font-bold text-slate-400 border-b border-slate-100">
                    <th className="pb-3">Fecha y Hora</th>
                    <th className="pb-3">Tipo y Categoria</th>
                    <th className="pb-3">Concepto / Referencia</th>
                    <th className="pb-3">Medio de Pago</th>
                    <th className="pb-3 text-right">Monto</th>
                    <th className="pb-3 text-right">Saldo en Caja</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredMovements.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <div className="max-w-xs mx-auto space-y-1">
                          <p className="font-bold text-slate-700 text-xs">No hay movimientos registrados</p>
                          <p className="text-[11px] text-slate-400">Las ventas en POS, abonos de fiado y egresos operacionales se reflejarán automáticamente aquí.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredMovements.map((mov) => {
                      const isPositive = mov.amount > 0;
                      return (
                        <tr key={mov.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3.5 text-slate-500 font-medium whitespace-nowrap">
                            {mov.date}
                          </td>
                          <td className="py-3.5">
                            <div className="font-bold text-slate-800">{mov.category}</div>
                            <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                              {mov.documentNumber}
                            </div>
                          </td>
                          <td className="py-3.5 text-slate-700 max-w-xs truncate">
                            {mov.concept}
                          </td>
                          <td className="py-3.5">
                            <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-md text-[10px] font-semibold">
                              {mov.paymentMethod}
                            </span>
                          </td>
                          <td className="py-3.5 text-right font-mono-tabular font-bold whitespace-nowrap">
                            <span className={isPositive ? 'text-emerald-600' : 'text-rose-600'}>
                              {isPositive ? '+' : ''} {formatCOP(mov.amount)}
                            </span>
                          </td>
                          <td className="py-3.5 text-right font-mono-tabular text-slate-600 font-semibold whitespace-nowrap">
                            {formatCOP(mov.runningBalance)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeMainTab === 'cierres' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center space-x-2.5">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                    isShiftOpen
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isShiftOpen ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                    }`}
                  />
                  <span>{isShiftOpen ? 'Caja Abierta' : 'Caja Cerrada'}</span>
                </span>
                <span className="text-xs font-bold text-slate-400">Terminal: {currentShiftData.registerNumber}</span>
              </div>

              <div>
                <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
                  Empleado encargado: {currentShiftData.cashierName}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Apertura: {currentShiftData.openedAt} | Turno gestionado en computador de mostrador compartido
                </p>
              </div>

              {isShiftOpen && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Base Apertura</span>
                    <p className="text-xs font-bold text-slate-800 font-mono-tabular mt-0.5">
                      {formatCOP(currentShiftData.initialCash)}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Ventas Efectivo</span>
                    <p className="text-xs font-bold text-emerald-600 font-mono-tabular mt-0.5">
                      + {formatCOP(currentShiftData.cashSales)}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Ventas Digitales</span>
                    <p className="text-xs font-bold text-[#18668F] font-mono-tabular mt-0.5">
                      {formatCOP(currentShiftData.electronicSales)}
                    </p>
                  </div>
                  <div className="p-3 bg-blue-50/60 rounded-2xl border border-blue-100">
                    <span className="text-[10px] font-bold text-[#18668F] uppercase">Efectivo en Caja</span>
                    <p className="text-xs font-extrabold text-[#18668F] font-mono-tabular mt-0.5">
                      {formatCOP(currentShiftData.expectedCash)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0">
              {isShiftOpen ? (
                <button
                  type="button"
                  onClick={() => setShowCloseShiftModal(true)}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-2xl shadow-xs transition-colors flex items-center justify-center space-x-1.5"
                >
                  <Clock className="w-4 h-4" />
                  <span>Cerrar Turno de Caja</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowOpenShiftModal(true)}
                  className="px-5 py-2.5 bg-[#18668F] hover:bg-[#135273] text-white font-bold text-xs rounded-2xl shadow-xs transition-colors flex items-center justify-center space-x-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Abrir Caja (Empezar Turno)</span>
                </button>
              )}
              <Link
                href="/pos"
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl transition-colors flex items-center justify-center space-x-1.5"
              >
                <Store className="w-4 h-4" />
                <span>Ir al Mostrador POS</span>
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-xs border border-slate-100 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                  Historial de Cierres de Caja
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Registro de arqueos de caja, bases, ventas del turno y auditoria de descuadres
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[11px] font-bold text-slate-400 border-b border-slate-100">
                    <th className="pb-3">Cierre / Apertura</th>
                    <th className="pb-3">Empleado Encargado</th>
                    <th className="pb-3 text-right">Base</th>
                    <th className="pb-3 text-right">Venta Efectivo</th>
                    <th className="pb-3 text-right">Digital</th>
                    <th className="pb-3 text-right">Efectivo Contado</th>
                    <th className="pb-3 text-center">Descuadre</th>
                    <th className="pb-3">Nota Aclaratoria</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {closures.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <div className="max-w-xs mx-auto space-y-1">
                          <p className="font-bold text-slate-700 text-xs">No hay cierres de caja registrados</p>
                          <p className="text-[11px] text-slate-400">Al finalizar un turno y realizar el arqueo, los comprobantes de cuadre de mostrador aparecerán listados aquí.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    closures.map((cls) => {
                      return (
                        <tr key={cls.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3.5 text-slate-700 whitespace-nowrap">
                            <div className="font-bold">{cls.closedAt}</div>
                            <div className="text-[10px] text-slate-400">Inicio: {cls.openedAt}</div>
                          </td>
                          <td className="py-3.5 font-bold text-slate-900">
                            {cls.cashierName}
                          </td>
                          <td className="py-3.5 text-right font-mono-tabular text-slate-600">
                            {formatCOP(cls.initialCash)}
                          </td>
                          <td className="py-3.5 text-right font-mono-tabular font-bold text-emerald-600">
                            {formatCOP(cls.cashSales)}
                          </td>
                          <td className="py-3.5 text-right font-mono-tabular text-slate-600">
                            {formatCOP(cls.electronicSales)}
                          </td>
                          <td className="py-3.5 text-right font-mono-tabular font-extrabold text-slate-900">
                            {formatCOP(cls.actualCash)}
                          </td>
                          <td className="py-3.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                cls.status === 'CUADRADO'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : cls.status === 'SOBRANTE'
                                  ? 'bg-blue-50 text-[#18668F]'
                                  : 'bg-rose-50 text-rose-700'
                              }`}
                            >
                              {cls.status === 'CUADRADO'
                                ? 'Cuadre Exacto'
                                : cls.status === 'SOBRANTE'
                                ? `Sobrante +${formatCOP(cls.difference)}`
                                : `Faltante ${formatCOP(cls.difference)}`}
                            </span>
                          </td>
                          <td className="py-3.5 text-slate-500 max-w-xs truncate" title={cls.notes}>
                            {cls.notes || 'Sin novedad'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showOpenShiftModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-extrabold text-slate-900">
                Abrir Caja - Empezar Turno
              </h2>
              <button
                type="button"
                onClick={() => setShowOpenShiftModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleOpenShiftSubmit} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Cajero en Turno</span>
                  <span className="font-extrabold text-slate-900 text-sm">{sessionUserName}</span>
                </div>
                <span className="px-2.5 py-1 bg-blue-50 text-[#18668F] text-[10px] font-bold rounded-lg border border-blue-200">
                  Sesión Activa
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-700 font-bold">
                    Base Inicial de Apertura (COP) *:
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowOpenCalc(!showOpenCalc)}
                    className="text-[#18668F] hover:underline font-bold flex items-center gap-1 text-[11px]"
                  >
                    <Calculator className="w-3.5 h-3.5" />
                    <span>{showOpenCalc ? 'Ocultar Desglose' : 'Conteo por Billetes'}</span>
                  </button>
                </div>
                <input
                  type="number"
                  min="0"
                  required
                  value={openInitialCash}
                  onChange={(e) => setOpenInitialCash(e.target.value)}
                  placeholder="100000"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#18668F]"
                />
              </div>

              {showOpenCalc && (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    Desglose de Billetes y Monedas COP
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {COLOMBIAN_DENOMINATIONS.map((d) => {
                      const qty = openDenomCounts[d.value] || 0;
                      return (
                        <div key={d.value} className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-xl border border-slate-200">
                          <span className="font-mono font-bold text-[11px] text-slate-700">{d.label}</span>
                          <input
                            type="number"
                            min="0"
                            value={qty || ''}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 0;
                              const updated = { ...openDenomCounts, [d.value]: val };
                              setOpenDenomCounts(updated);
                              const total = calculateCashTotal(updated);
                              setOpenInitialCash(total.toString());
                            }}
                            placeholder="0"
                            className="w-14 text-right px-1.5 py-0.5 text-xs font-mono font-bold border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#18668F]"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowOpenShiftModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#18668F] hover:bg-[#135273] text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  Empezar Turno
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCloseShiftModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Cerrar Caja - Arqueo de Turno
                </h2>
                <p className="text-[11px] text-slate-400">
                  Auditoría de efectivo y balance de caja física
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCloseShiftModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCloseShiftSubmit} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Cajero(a) Responsable</span>
                  <span className="font-extrabold text-slate-900 text-sm">{currentShiftData.cashierName || sessionUserName}</span>
                </div>
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-lg border border-emerald-200">
                  {currentShiftData.registerNumber}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-blue-50/50 rounded-2xl border border-blue-100">
                <div>
                  <span className="font-extrabold text-slate-800 text-xs block">Arqueo Ciego de Seguridad</span>
                  <span className="text-[10px] text-slate-500">
                    Oculta los valores esperados para evitar sesgos durante el conteo
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setBlindCountMode(!blindCountMode)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                    blindCountMode ? 'bg-[#18668F]' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform mt-0.5 ${
                      blindCountMode ? 'translate-x-4 ml-0.5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {blindCountMode && !revealBlindCount ? (
                <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-center space-y-2">
                  <p className="text-xs font-bold text-slate-700">Valores del sistema protegidos en Modo Ciego</p>
                  <p className="text-[11px] text-slate-400">
                    Realice el conteo físico de los billetes y monedas en caja. Puede revelar las cifras en cualquier momento.
                  </p>
                  <button
                    type="button"
                    onClick={() => setRevealBlindCount(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-[#18668F] hover:bg-slate-50 rounded-xl font-bold text-xs shadow-xs"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Revelar Cifras del Sistema</span>
                  </button>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                  <div className="flex justify-between text-slate-500">
                    <span>Base Inicial:</span>
                    <span className="font-mono font-bold text-slate-800">{formatCOP(currentShiftData.initialCash)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Ventas en Efectivo:</span>
                    <span className="font-mono font-bold text-emerald-600">+{formatCOP(currentShiftData.cashSales)}</span>
                  </div>
                  <div className="flex justify-between text-slate-900 font-extrabold pt-1 border-t border-slate-200">
                    <span>Efectivo Esperado en Caja:</span>
                    <span className="font-mono text-[#18668F]">{formatCOP(currentShiftData.expectedCash)}</span>
                  </div>
                </div>
              )}

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    Conteo Físico por Denominación COP
                  </span>
                  <span className="font-mono font-bold text-xs text-slate-800">
                    Total: {formatCOP(parseFloat(closeActualCash) || 0)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {COLOMBIAN_DENOMINATIONS.map((d) => {
                    const qty = closeDenomCounts[d.value] || 0;
                    return (
                      <div key={d.value} className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-xl border border-slate-200">
                        <span className="font-mono font-bold text-[11px] text-slate-700">{d.label}</span>
                        <input
                          type="number"
                          min="0"
                          value={qty || ''}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 0;
                            const updated = { ...closeDenomCounts, [d.value]: val };
                            setCloseDenomCounts(updated);
                            const total = calculateCashTotal(updated);
                            setCloseActualCash(total.toString());
                          }}
                          placeholder="0"
                          className="w-14 text-right px-1.5 py-0.5 text-xs font-mono font-bold border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#18668F]"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Efectivo Total Real Contado en Caja (COP) *:
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  placeholder="Ingrese el conteo de billetes y monedas"
                  value={closeActualCash}
                  onChange={(e) => setCloseActualCash(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#18668F]"
                />
              </div>

              {(!blindCountMode || revealBlindCount) && closeActualCash !== '' && (
                <div
                  className={`p-3 rounded-2xl text-xs font-bold ${
                    parseFloat(closeActualCash) === currentShiftData.expectedCash
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : parseFloat(closeActualCash) > currentShiftData.expectedCash
                      ? 'bg-blue-50 text-[#18668F] border border-blue-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {parseFloat(closeActualCash) === currentShiftData.expectedCash ? (
                    <span>Cuadre exacto: No hay diferencia de dinero.</span>
                  ) : parseFloat(closeActualCash) > currentShiftData.expectedCash ? (
                    <span>
                      Sobrante en caja de +{formatCOP(parseFloat(closeActualCash) - currentShiftData.expectedCash)}
                    </span>
                  ) : (
                    <span>
                      Faltante en caja de {formatCOP(parseFloat(closeActualCash) - currentShiftData.expectedCash)}
                    </span>
                  )}
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Nota Aclaratoria {closeActualCash !== '' && parseFloat(closeActualCash) !== currentShiftData.expectedCash ? '*' : '(Opcional)'}:
                </label>
                <textarea
                  rows={2}
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="Ej: Se pagó servicio urgente de flete o ajuste por redondeo..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#18668F]"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCloseShiftModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={closeActualCash === '' || (parseFloat(closeActualCash) !== currentShiftData.expectedCash && !closeNotes.trim())}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  Confirmar Cierre de Caja
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showNewMovementModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-extrabold text-slate-900">
                Registrar Movimiento de Caja
              </h2>
              <button
                type="button"
                onClick={() => setShowNewMovementModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMovement} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Naturaleza del Movimiento:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMovType('INGRESO')}
                    className={`py-2 text-xs font-bold rounded-xl border transition-colors ${
                      movType === 'INGRESO'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Ingreso (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovType('EGRESO')}
                    className={`py-2 text-xs font-bold rounded-xl border transition-colors ${
                      movType === 'EGRESO'
                        ? 'bg-rose-50 border-rose-500 text-rose-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Egreso (-)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Categoria de Flujo:
                </label>
                <select
                  value={movCategory}
                  onChange={(e) => setMovCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                >
                  <option value="Gasto de Caja Menor">Gasto de Caja Menor</option>
                  <option value="Insumos Inmediatos">Insumos Inmediatos</option>
                  <option value="Pago Servicios">Pago de Servicios</option>
                  <option value="Aporte de Capital">Aporte de Capital / Base</option>
                  <option value="Retiro de Utilidades">Retiro de Utilidades</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Monto (COP):
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  placeholder="Ej: 50000"
                  value={movAmount}
                  onChange={(e) => setMovAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold font-mono text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Concepto / Descripcion:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Compra de cinta de embalaje y bolsas"
                  value={movConcept}
                  onChange={(e) => setMovConcept(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Medio de Pago:
                </label>
                <select
                  value={movPaymentMethod}
                  onChange={(e) => setMovPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                >
                  <option value="EFECTIVO">Efectivo de Caja</option>
                  <option value="TRANSFERENCIA">Transferencia Bancaria</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewMovementModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#18668F] hover:bg-[#135273] text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  Guardar Movimiento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
