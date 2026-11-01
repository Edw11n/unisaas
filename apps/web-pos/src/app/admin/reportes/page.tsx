'use client';

import React, { useState } from 'react';
import { formatCOP } from '@/lib/currency';

export default function AdminReportesPage() {
  const [reportType, setReportType] = useState<'ventas' | 'cartera' | 'inventario' | 'balance'>('ventas');
  const [dateRange, setDateRange] = useState('ESTE_MES');

  const salesReportData: {
    period: string;
    salesCount: number;
    cash: number;
    card: number;
    credit: number;
    total: number;
  }[] = [];

  const totalSalesMonth = salesReportData.reduce((sum, row) => sum + row.total, 0);
  const totalSalesCount = salesReportData.reduce((sum, row) => sum + row.salesCount, 0);
  const cashRecaudo = salesReportData.reduce((sum, row) => sum + row.cash, 0);
  const cardRecaudo = salesReportData.reduce((sum, row) => sum + row.card, 0);
  const creditRecaudo = salesReportData.reduce((sum, row) => sum + row.credit, 0);

  const cashPct = totalSalesMonth > 0 ? ((cashRecaudo / totalSalesMonth) * 100).toFixed(1) : '0.0';
  const cardPct = totalSalesMonth > 0 ? ((cardRecaudo / totalSalesMonth) * 100).toFixed(1) : '0.0';
  const creditPct = totalSalesMonth > 0 ? ((creditRecaudo / totalSalesMonth) * 100).toFixed(1) : '0.0';

  const agingCreditData: {
    range: string;
    amount: number;
    clientsCount: number;
    pct: string;
  }[] = [];

  const inventoryValuationData: {
    category: string;
    totalUnits: number;
    valCost: number;
    valSale: number;
    potentialMargin: string;
  }[] = [];

  const balanceVentas = totalSalesMonth;
  const balanceCosto = 0;
  const balanceGastos = 0;
  const balanceUtilidad = balanceVentas - balanceCosto - balanceGastos;

  const handleExportExcel = () => {
    let headers = '';
    let rows: string[] = [];
    let filename = '';

    if (reportType === 'ventas') {
      headers = 'Periodo,Cantidad_Ventas,Efectivo_COP,Electronico_COP,Credito_Fiado_COP,Total_COP';
      rows = salesReportData.map((d) =>
        `"${d.period}",${d.salesCount},${d.cash},${d.card},${d.credit},${d.total}`
      );
      if (rows.length === 0) {
        rows = ['"Sin ventas registradas en el periodo",0,0,0,0,0'];
      }
      filename = `reporte_ventas_${dateRange.toLowerCase()}_unisaas.csv`;
    } else if (reportType === 'cartera') {
      headers = 'Rango_Antiguedad,Monto_Deuda_COP,Clientes_En_Rango,Porcentaje_Cartera';
      rows = agingCreditData.map((d) =>
        `"${d.range}",${d.amount},${d.clientsCount},"${d.pct}"`
      );
      filename = `reporte_cartera_fiado_${dateRange.toLowerCase()}_unisaas.csv`;
    } else if (reportType === 'inventario') {
      headers = 'Categoria,Unidades_Disponibles,Valor_Costo_CPP_COP,Valor_Venta_COP,Margen_Potencial';
      rows = inventoryValuationData.map((d) =>
        `"${d.category}",${d.totalUnits},${d.valCost},${d.valSale},"${d.potentialMargin}"`
      );
      if (rows.length === 0) {
        rows = ['"Sin inventario registrado",0,0,0,"0.0%"'];
      }
      filename = `reporte_valoracion_inventario_unisaas.csv`;
    } else {
      headers = 'Concepto,Monto_COP';
      rows = [
        `"Ventas Totales Facturadas",${balanceVentas}`,
        `"(-) Costo de Venta Estimado (Materia Prima)",-${balanceCosto}`,
        `"(-) Gastos Operativos de Caja y Servicios",-${balanceGastos}`,
        `"Utilidad Operativa Bruta Estimada",${balanceUtilidad}`,
      ];
      filename = `reporte_balance_operativo_${dateRange.toLowerCase()}_unisaas.csv`;
    }

    const csvContent = `\uFEFF${headers}\n${rows.join('\n')}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Encabezado y Filtro de Rango */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Reportes Gerenciales y Contables
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Analitica de ventas, antiguedad de cartera, valoracion de inventario y balance operativo
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="bg-white px-3 py-2 rounded-2xl border border-slate-200 shadow-xs text-xs">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="bg-transparent border-0 font-bold text-slate-800 focus:outline-none"
            >
              <option value="HOY">Jornada de Hoy</option>
              <option value="ESTA_SEMANA">Esta Semana</option>
              <option value="ESTE_MES">Este Mes</option>
              <option value="ANIO_2026">Ano Fiscal 2026</option>
            </select>
          </div>
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-2xl shadow-xs transition-colors cursor-pointer"
          >
            Exportar Excel
          </button>
          <button
            type="button"
            onClick={handlePrintReport}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-2xl shadow-xs transition-colors cursor-pointer"
          >
            Imprimir
          </button>
        </div>
      </div>

      {/* Pestañas de Tipo de Reporte */}
      <div className="flex items-center space-x-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setReportType('ventas')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
            reportType === 'ventas'
              ? 'border-[#18668F] text-[#18668F]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Ventas y Medios de Pago
        </button>
        <button
          type="button"
          onClick={() => setReportType('cartera')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
            reportType === 'cartera'
              ? 'border-[#18668F] text-[#18668F]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Antiguedad de Cartera (Fiado)
        </button>
        <button
          type="button"
          onClick={() => setReportType('inventario')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
            reportType === 'inventario'
              ? 'border-[#18668F] text-[#18668F]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Inventario Valorizado CPP
        </button>
        <button
          type="button"
          onClick={() => setReportType('balance')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
            reportType === 'balance'
              ? 'border-[#18668F] text-[#18668F]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Balance Operativo Simplificado
        </button>
      </div>

      {/* Reporte 1: Ventas y Medios de Pago */}
      {reportType === 'ventas' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-100">
              <div className="text-xs text-slate-400 font-semibold">Total Facturado en Mes</div>
              <div className="text-2xl font-extrabold text-slate-900 mt-1 font-mono">
                {formatCOP(totalSalesMonth)}
              </div>
              <div className="text-[10px] text-emerald-600 mt-0.5">
                {totalSalesCount} transacciones POS
              </div>
            </div>
            <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-100">
              <div className="text-xs text-slate-400 font-semibold">Recaudo en Efectivo</div>
              <div className="text-2xl font-extrabold text-emerald-700 mt-1 font-mono">
                {formatCOP(cashRecaudo)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">{cashPct}% del volumen total</div>
            </div>
            <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-100">
              <div className="text-xs text-slate-400 font-semibold">Datafono y Tarjetas</div>
              <div className="text-2xl font-extrabold text-blue-700 mt-1 font-mono">
                {formatCOP(cardRecaudo)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">{cardPct}% del volumen total</div>
            </div>
            <div className="bg-white p-5 rounded-3xl shadow-xs border border-slate-100">
              <div className="text-xs text-slate-400 font-semibold">Ventas a Credito (Fiado)</div>
              <div className="text-2xl font-extrabold text-amber-700 mt-1 font-mono">
                {formatCOP(creditRecaudo)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">{creditPct}% del volumen total</div>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-xs border border-slate-100 p-6 space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900">
              Consolidado Semanal de Ventas y Comprobantes
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[11px] font-bold text-slate-400 border-b border-slate-100">
                    <th className="pb-3">Periodo / Semana</th>
                    <th className="pb-3 text-center">N° Comprobantes</th>
                    <th className="pb-3 text-right">Efectivo</th>
                    <th className="pb-3 text-right">Tarjeta</th>
                    <th className="pb-3 text-right">Credito (Fiado)</th>
                    <th className="pb-3 text-right">Total Facturado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {salesReportData.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                        Esta nueva empresa inicia con 0 comprobantes y $ 0 facturados. Las ventas del mostrador POS se consolidaran automaticamente aqui.
                      </td>
                    </tr>
                  ) : (
                    salesReportData.map((row) => (
                      <tr key={row.period} className="hover:bg-slate-50/50">
                        <td className="py-3.5 font-bold text-slate-900">{row.period}</td>
                        <td className="py-3.5 text-center font-mono">{row.salesCount}</td>
                        <td className="py-3.5 text-right font-mono text-emerald-700">{formatCOP(row.cash)}</td>
                        <td className="py-3.5 text-right font-mono text-blue-700">{formatCOP(row.card)}</td>
                        <td className="py-3.5 text-right font-mono text-amber-700">{formatCOP(row.credit)}</td>
                        <td className="py-3.5 text-right font-mono font-extrabold text-slate-900">{formatCOP(row.total)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Reporte 2: Antiguedad de Cartera */}
      {reportType === 'cartera' && (
        <div className="space-y-4">
          {agingCreditData.length === 0 ? (
            <div className="bg-white rounded-3xl shadow-xs border border-slate-100 p-12 text-center">
              <div className="text-sm font-bold text-slate-700">Sin datos disponibles</div>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                No hay cuentas por cobrar registradas para el periodo seleccionado.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {agingCreditData.map((ag) => (
                <div key={ag.range} className="bg-white p-5 rounded-3xl shadow-xs border border-slate-100">
                  <div className="text-xs text-slate-400 font-semibold">{ag.range}</div>
                  <div className="text-2xl font-extrabold text-slate-900 mt-1 font-mono">
                    {formatCOP(ag.amount)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {ag.clientsCount} clientes ({ag.pct} de la cartera)
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white rounded-3xl shadow-xs border border-slate-100 p-6 space-y-3">
            <h3 className="text-sm font-extrabold text-slate-900">
              Evaluacion de Riesgo y Recuperacion de Cartera
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {agingCreditData.length === 0
                ? 'Sin datos disponibles. No hay informacion de cartera para evaluar en el periodo seleccionado.'
                : 'Los clientes con moras superiores a 30 dias se encuentran con el servicio de fiado bloqueado automaticamente en el POS para proteger la liquidez del negocio.'}
            </p>
          </div>
        </div>
      )}

      {/* Reporte 3: Inventario Valorizado */}
      {reportType === 'inventario' && (
        <div className="bg-white rounded-3xl shadow-xs border border-slate-100 p-6 space-y-4">
          <h3 className="text-sm font-extrabold text-slate-900">
            Valoracion de Existencias por Costo Promedio Ponderado (NIIF)
          </h3>
          {inventoryValuationData.length === 0 ? (
            <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl">
              <div className="text-sm font-bold text-slate-700">Inventario valorizado en $ 0</div>
              <div className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                No hay articulos registrados en el catalogo para esta nueva empresa. Dirijase a Productos e Inventario para registrar referencias o cargar su lista de precios.
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[11px] font-bold text-slate-400 border-b border-slate-100">
                    <th className="pb-3">Categoria</th>
                    <th className="pb-3 text-center">Unidades en Stock</th>
                    <th className="pb-3 text-right">Valor a Costo CPP</th>
                    <th className="pb-3 text-right">Valor Proyectado Venta</th>
                    <th className="pb-3 text-right">Margen Bruto Estimado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {inventoryValuationData.map((inv) => (
                    <tr key={inv.category} className="hover:bg-slate-50/50">
                      <td className="py-3.5 font-bold text-slate-900">{inv.category}</td>
                      <td className="py-3.5 text-center font-mono">{inv.totalUnits}</td>
                      <td className="py-3.5 text-right font-mono text-slate-700">{formatCOP(inv.valCost)}</td>
                      <td className="py-3.5 text-right font-mono font-bold text-[#18668F]">{formatCOP(inv.valSale)}</td>
                      <td className="py-3.5 text-right font-mono font-bold text-emerald-600">{inv.potentialMargin}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Reporte 4: Balance Operativo Simplificado */}
      {reportType === 'balance' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-3xl shadow-xs border border-slate-100 space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900">Resumen de Ingresos vs Egresos</h3>
            <div className="divide-y divide-slate-100 text-xs space-y-2">
              <div className="flex justify-between py-2">
                <span className="text-slate-600">Ventas Totales Facturadas:</span>
                <span className="font-mono font-bold text-slate-900">{formatCOP(balanceVentas)}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-600">(-) Costo de Venta Estimado (Materia Prima):</span>
                <span className="font-mono font-bold text-rose-600">- {formatCOP(balanceCosto)}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-600">(-) Gastos Operativos de Caja y Servicios:</span>
                <span className="font-mono font-bold text-rose-600">- {formatCOP(balanceGastos)}</span>
              </div>
              <div className="flex justify-between py-3 font-extrabold text-sm text-slate-900 border-t border-slate-200">
                <span>Utilidad Operativa Bruta Estimada:</span>
                <span className="text-emerald-600 font-mono text-base">{formatCOP(balanceUtilidad)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-xs border border-slate-100 space-y-3">
            <h3 className="text-sm font-extrabold text-slate-900">Nota Contable</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Sin datos disponibles. Los asientos contables se actualizaran en tiempo real a medida que se ejecuten transacciones y ventas en Squad 2 (Accounting Engine Ledger).
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
