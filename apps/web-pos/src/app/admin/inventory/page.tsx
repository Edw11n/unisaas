'use client';

import React, { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  ArrowUpDown,
  SlidersHorizontal,
  CheckCircle2,
  X,
  Loader2,
} from 'lucide-react';
import { formatCOP } from '@/lib/currency';

export default function AdminInventoryPage() {
  const [products, setProducts] = useState<any[]>([
    {
      id: 'prod-1',
      sku: 'SKU-ARR-001',
      name: 'Arroz Florhuila 1kg',
      barcode: '7701234567890',
      category: 'Granos y Abarrotes',
      stock: 45,
      minStock: 10,
      costPrice: 3400,
      salePrice: 4500,
      status: 'ACTIVE',
    },
    {
      id: 'prod-2',
      sku: 'SKU-ACE-002',
      name: 'Aceite Premier 1000ml',
      barcode: '7701234567891',
      category: 'Aceites y Grasas',
      stock: 4,
      minStock: 8,
      costPrice: 8500,
      salePrice: 11000,
      status: 'ACTIVE',
    },
    {
      id: 'prod-3',
      sku: 'SKU-PAN-003',
      name: 'Pan Tajado Bimbo Grande',
      barcode: '7701234567892',
      category: 'Panadería',
      stock: 18,
      minStock: 5,
      costPrice: 4800,
      salePrice: 6500,
      status: 'ACTIVE',
    },
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  // Formulario nuevo producto
  const [newSku, setNewSku] = useState('');
  const [newName, setNewName] = useState('');
  const [newBarcode, setNewBarcode] = useState('');
  const [newCostPrice, setNewCostPrice] = useState('');
  const [newSalePrice, setNewSalePrice] = useState('');
  const [newMinStock, setNewMinStock] = useState('5');

  // Formulario ajuste
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('CORRECTION');

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.barcode && p.barcode.includes(searchTerm)),
  );

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newSku.trim()) return;

    const newProd = {
      id: `prod-${Date.now()}`,
      sku: newSku.trim(),
      name: newName.trim(),
      barcode: newBarcode.trim() || undefined,
      category: 'General',
      stock: 0,
      minStock: Number(newMinStock) || 5,
      costPrice: Number(newCostPrice) || 0,
      salePrice: Number(newSalePrice) || 0,
      status: 'ACTIVE',
    };

    setProducts([newProd, ...products]);
    setShowCreateModal(false);
    setNewName('');
    setNewSku('');
    setNewBarcode('');
    setNewCostPrice('');
    setNewSalePrice('');
  };

  const handleApplyAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !adjustQty) return;

    const delta = Number(adjustQty);
    setProducts(
      products.map((p) =>
        p.id === selectedProduct.id
          ? { ...p, stock: Math.max(0, p.stock + delta) }
          : p,
      ),
    );
    setShowAdjustModal(false);
    setSelectedProduct(null);
    setAdjustQty('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Catálogo de Productos & Kardex</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Control de existencias físicas, costos promedio ponderados (CPP) y alertas de reabastecimiento.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2.5 bg-sky-700 hover:bg-sky-800 text-white font-bold rounded-xl text-xs flex items-center space-x-2 shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Crear Nuevo Producto</span>
        </button>
      </div>

      {/* Search & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre, SKU o código de barras..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-sky-500 outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">SKU / Código</th>
                <th className="py-3 px-4">Producto</th>
                <th className="py-3 px-4 text-right">Existencias</th>
                <th className="py-3 px-4 text-right">Costo Promedio (CPP)</th>
                <th className="py-3 px-4 text-right">Precio Venta</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map((p) => {
                const isLowStock = p.stock <= p.minStock;
                return (
                  <tr key={p.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-sky-700">{p.sku}</span>
                      {p.barcode && (
                        <span className="block text-[10px] text-slate-400 font-mono">
                          {p.barcode}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{p.name}</td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`font-mono font-bold px-2 py-0.5 rounded ${
                          isLowStock
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {p.stock}
                      </span>
                      {isLowStock && (
                        <span className="block text-[10px] text-amber-600 font-semibold mt-0.5">
                          Mínimo: {p.minStock}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-600">
                      {formatCOP(p.costPrice)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {formatCOP(p.salePrice)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        ACTIVO
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => {
                          setSelectedProduct(p);
                          setShowAdjustModal(true);
                        }}
                        className="px-2.5 py-1 text-sky-700 hover:bg-sky-50 rounded-lg text-xs font-semibold"
                      >
                        Ajustar Stock
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Crear Producto */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Crear Nuevo Producto</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Nombre del Producto *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ej. Azúcar Manuelita 1kg"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">SKU *</label>
                  <input
                    type="text"
                    required
                    value={newSku}
                    onChange={(e) => setNewSku(e.target.value)}
                    placeholder="SKU-AZU-001"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Código de Barras</label>
                  <input
                    type="text"
                    value={newBarcode}
                    onChange={(e) => setNewBarcode(e.target.value)}
                    placeholder="770123456789"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Precio Costo ($)</label>
                  <input
                    type="number"
                    value={newCostPrice}
                    onChange={(e) => setNewCostPrice(e.target.value)}
                    placeholder="3200"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Precio Venta ($) *</label>
                  <input
                    type="number"
                    required
                    value={newSalePrice}
                    onChange={(e) => setNewSalePrice(e.target.value)}
                    placeholder="4500"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-sky-500 outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Stock Mínimo</label>
                  <input
                    type="number"
                    value={newMinStock}
                    onChange={(e) => setNewMinStock(e.target.value)}
                    placeholder="5"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-sky-500 outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-sky-700 hover:bg-sky-800 text-white font-bold rounded-lg"
                >
                  Guardar Producto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ajustar Stock */}
      {showAdjustModal && selectedProduct && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Ajustar Stock Manual</h3>
              <button onClick={() => setShowAdjustModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl text-xs space-y-1">
              <p className="font-bold text-slate-900">{selectedProduct.name}</p>
              <p className="text-slate-500">Existencias actuales: <strong>{selectedProduct.stock}</strong></p>
            </div>

            <form onSubmit={handleApplyAdjustment} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Cantidad a Ajustar (positiva o negativa) *</label>
                <input
                  type="number"
                  required
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  placeholder="Ej. 10 para entrada, -2 para salida"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-sky-500 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Motivo del Ajuste</label>
                <select
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-sky-500 outline-none bg-white"
                >
                  <option value="CORRECTION">Corrección de inventario</option>
                  <option value="DAMAGE">Daño / Avería</option>
                  <option value="LOSS">Pérdida / Merma</option>
                  <option value="FOUND">Encontrado en bodega</option>
                  <option value="STOCK_COUNT">Conteo físico</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-sky-700 hover:bg-sky-800 text-white font-bold rounded-lg"
                >
                  Aplicar Ajuste
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

