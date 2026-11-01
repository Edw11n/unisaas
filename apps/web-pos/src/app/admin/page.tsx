'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  Receipt,
  Package,
  Users,
  Store,
  ArrowRight,
  AlertTriangle,
  Scale,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import { formatCOP } from '@/lib/currency';

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState({
    todaySales: 1450000,
    monthSales: 38250000,
    invoicesCount: 48,
    activeProducts: 124,
    lowStockCount: 3,
    cashOnHand: 890000,
  });

  const [recentInvoices, setRecentInvoices] = useState<any[]>([
    {
      id: 'inv-1',
      invoiceNumber: 'POS-001048',
      createdAt: new Date().toISOString(),
      customerName: 'Cliente Ocasional',
      paymentMethod: 'EFECTIVO',
      total: 85000,
      status: 'ISSUED',
    },
    {
      id: 'inv-2',
      invoiceNumber: 'POS-001047',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      customerName: 'Carlos Mario Gómez',
      paymentMethod: 'NEQUI',
      total: 120000,
      status: 'ISSUED',
    },
    {
      id: 'inv-3',
      invoiceNumber: 'POS-001046',
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      customerName: 'Supermercado La Colina',
      paymentMethod: 'CREDITO',
      total: 340000,
      status: 'ISSUED',
    },
  ]);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-sky-800 to-indigo-900 rounded-2xl p-6 sm:p-8 text-white shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="text-xs uppercase tracking-wider text-sky-200 font-bold bg-sky-900/60 px-2.5 py-1 rounded-full">
            Panel de Control Gerencial
          </span>
          <h1 className="text-2xl font-black mt-2">Bienvenido a tu Consola Administrativa</h1>
          <p className="text-xs sm:text-sm text-sky-100 max-w-xl mt-1">
            Supervisa en tiempo real tus ventas, existencias de inventario, causaciones contables y arqueos de caja bajo aislamiento multi-tenant RLS.
          </p>
        </div>
        <Link
          href="/pos"
          className="px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-sm flex items-center space-x-2 shadow-md transition flex-shrink-0"
        >
          <Store className="w-4 h-4" />
          <span>Ir a Cobrar al Mostrador POS</span>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Ventas de Hoy</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-xl font-black text-slate-900">{formatCOP(metrics.todaySales)}</h3>
          <p className="text-[11px] text-emerald-600 font-medium mt-1">
            {metrics.invoicesCount} transacciones en mostrador
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Ventas del Mes</span>
            <div className="p-2 bg-sky-50 text-sky-600 rounded-xl">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-xl font-black text-slate-900">{formatCOP(metrics.monthSales)}</h3>
          <p className="text-[11px] text-slate-500 font-medium mt-1">Acumulado mes en curso</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Catálogo & Stock</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-xl font-black text-slate-900">{metrics.activeProducts} Productos</h3>
          <p className="text-[11px] text-amber-600 font-medium mt-1 flex items-center space-x-1">
            <AlertTriangle className="w-3 h-3" />
            <span>{metrics.lowStockCount} con stock bajo mínimo</span>
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Efectivo en Caja</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-xl font-black text-slate-900">{formatCOP(metrics.cashOnHand)}</h3>
          <p className="text-[11px] text-slate-500 font-medium mt-1">Turno actual de caja abierto</p>
        </div>
      </div>

      {/* Main Grid: Quick Links & Recent Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Recent Invoices Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Últimas Ventas Emitidas</h2>
              <p className="text-xs text-slate-500">Comprobantes POS registrados en tiempo real</p>
            </div>
            <Link
              href="/admin/invoices"
              className="text-xs text-sky-700 hover:text-sky-800 font-bold flex items-center space-x-1"
            >
              <span>Ver todas</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-y border-slate-100">
                <tr>
                  <th className="py-2.5 px-3">Consecutivo</th>
                  <th className="py-2.5 px-3">Cliente</th>
                  <th className="py-2.5 px-3">Medio de Pago</th>
                  <th className="py-2.5 px-3 text-right">Total</th>
                  <th className="py-2.5 px-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-3 font-mono font-bold text-sky-700">{inv.invoiceNumber}</td>
                    <td className="py-3 px-3 text-slate-800 font-medium">{inv.customerName}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                        {inv.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900">
                      {formatCOP(inv.total)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>EMITIDA</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Operational Shortcuts & Status */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Accesos Rápidos de Gestión</h3>

            <div className="space-y-2">
              <Link
                href="/admin/inventory"
                className="w-full p-3 rounded-xl border border-slate-100 hover:border-sky-300 hover:bg-sky-50/40 flex items-center justify-between text-xs font-semibold transition"
              >
                <div className="flex items-center space-x-2.5">
                  <div className="p-1.5 bg-sky-100 text-sky-700 rounded-lg">
                    <Package className="w-4 h-4" />
                  </div>
                  <span>Gestionar Productos & Kardex</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>

              <Link
                href="/admin/balance"
                className="w-full p-3 rounded-xl border border-slate-100 hover:border-emerald-300 hover:bg-emerald-50/40 flex items-center justify-between text-xs font-semibold transition"
              >
                <div className="flex items-center space-x-2.5">
                  <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                    <Scale className="w-4 h-4" />
                  </div>
                  <span>Balance General & Contabilidad</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>

              <Link
                href="/admin/clients"
                className="w-full p-3 rounded-xl border border-slate-100 hover:border-indigo-300 hover:bg-indigo-50/40 flex items-center justify-between text-xs font-semibold transition"
              >
                <div className="flex items-center space-x-2.5">
                  <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                    <Users className="w-4 h-4" />
                  </div>
                  <span>Cartera & Fiados de Clientes</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>

              <Link
                href="/admin/team"
                className="w-full p-3 rounded-xl border border-slate-100 hover:border-amber-300 hover:bg-amber-50/40 flex items-center justify-between text-xs font-semibold transition"
              >
                <div className="flex items-center space-x-2.5">
                  <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
                    <Users className="w-4 h-4" />
                  </div>
                  <span>Crear Código para Cajero</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>
            </div>
          </div>

          <div className="bg-sky-50 rounded-2xl border border-sky-100 p-5">
            <h4 className="text-xs font-bold text-sky-900 uppercase tracking-wider mb-2">
              Estado de la Plataforma
            </h4>
            <div className="space-y-2 text-xs text-sky-800">
              <div className="flex items-center justify-between">
                <span>Motor Contable NIIF:</span>
                <span className="font-bold text-emerald-700">Activo (Squad 2)</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Kardex & CPP:</span>
                <span className="font-bold text-emerald-700">En Línea (Squad 3)</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Aislamiento RLS:</span>
                <span className="font-bold text-emerald-700">100% Blindado</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

