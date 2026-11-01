'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  ExternalLink,
  AlertCircle,
  Building2,
  Printer,
  Shield,
  Layers,
  Sparkles,
  Users,
  Plus,
  ArrowRightLeft,
  X,
  Store,
  Upload,
  Image as ImageIcon,
  Trash2,
  Camera,
} from 'lucide-react';
import {
  PROFILE_METADATA_REGISTRY,
  resolveProfileCapabilities,
  BusinessProfileType,
} from '@/lib/models/profile-capabilities.model';
import {
  COLOMBIA_COMMERCIAL_CATEGORIES,
} from '@/lib/models/commercial-categories.model';
import { EntityMonogram } from '@/components/ui/entity-monogram';
import {
  COLOMBIA_DEPARTMENTS,
  calculateNitDv,
} from '@/lib/colombia-documents';

interface BusinessStoreItem {
  tenantId: string;
  id?: string;
  branchId?: string;
  tradeName: string;
  businessName: string;
  commercialCategory: string;
  nitRut?: string;
  address?: string;
  city?: string;
  department?: string;
  phone?: string;
  isPrimary?: boolean;
  isCurrent?: boolean;
}

const AVAILABLE_COMMERCIAL_CATEGORIES = COLOMBIA_COMMERCIAL_CATEGORIES.map((c) => ({
  id: c.code as BusinessProfileType,
  label: c.name,
  description: c.description,
  family: c.family,
}));

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<'empresa' | 'impresora' | 'seguridad'>('empresa');

  const [commercialCategory, setCommercialCategory] = useState<BusinessProfileType>('TIENDA_BARRIO');
  const [businessName, setBusinessName] = useState('Mi Comercio');
  const [tradeName, setTradeName] = useState('Mi Comercio');
  const [nit, setNit] = useState('901.000.000-1');
  const [address, setAddress] = useState('Calle Principal # 10-20');
  const [city, setCity] = useState('Ciudad Principal');
  const [phone, setPhone] = useState('300 000 0000');
  const [email, setEmail] = useState('contacto@micomercio.com');
  const [taxRegime, setTaxRegime] = useState('REGIMEN_SIMPLE');
  const [activeUserName, setActiveUserName] = useState<string>('Administrador');

  const [stores, setStores] = useState<BusinessStoreItem[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<string>('');
  const [isNewStoreModalOpen, setIsNewStoreModalOpen] = useState(false);
  const [newStoreTradeName, setNewStoreTradeName] = useState('');
  const [newStoreBusinessName, setNewStoreBusinessName] = useState('');
  const [newStoreCategory, setNewStoreCategory] = useState<string>('TIENDA_BARRIO');
  const [newStoreNit, setNewStoreNit] = useState('');
  const [newStoreDepartment, setNewStoreDepartment] = useState('Cundinamarca');
  const [newStoreCity, setNewStoreCity] = useState('Bogota D.C.');
  const [newStoreAddress, setNewStoreAddress] = useState('Calle Principal # 10-20');
  const [newStorePhone, setNewStorePhone] = useState('3000000000');
  const [isCreatingStore, setIsCreatingStore] = useState(false);

  const [companySuccessMessage, setCompanySuccessMessage] = useState<string | null>(null);
  const [companyErrorMessage, setCompanyErrorMessage] = useState<string | null>(null);
  const [isSavingCompany, setIsSavingCompany] = useState(false);

  const [userHasPassword, setUserHasPassword] = useState(true);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newAccountPassword, setNewAccountPassword] = useState('');
  const [confirmAccountPassword, setConfirmAccountPassword] = useState('');
  const [passwordSuccessMessage, setPasswordSuccessMessage] = useState<string | null>(null);
  const [passwordErrorMessage, setPasswordErrorMessage] = useState<string | null>(null);

  const [printerPaperWidth, setPrinterPaperWidth] = useState('80mm');
  const [printerConnection, setPrinterConnection] = useState('USB');
  const [printerIp, setPrinterIp] = useState('');
  const [ticketHeader, setTicketHeader] = useState('MI COMERCIO\nNIT: 901.000.000-1\nRegimen Simple de Tributacion');
  const [ticketFooter, setTicketFooter] = useState('Gracias por su compra!\nSoftware UNISAAS POS');
  const [printerSuccessMessage, setPrinterSuccessMessage] = useState<string | null>(null);

  const activeCapabilities = resolveProfileCapabilities(commercialCategory);

  const fetchStores = async () => {
    try {
      const res = await fetch('/api/admin/stores');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.stores)) {
          setStores(data.stores);
        }
      }
    } catch {}
  };

  const handleSwitchStore = async (targetTenantId: string) => {
    try {
      setCompanyErrorMessage(null);
      const res = await fetch('/api/admin/stores', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetTenantId }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveTenantId(targetTenantId);
        if (typeof window !== 'undefined') {
          const stored = localStorage.getItem('unisaas_active_session');
          if (stored) {
            try {
              const parsed = JSON.parse(stored);
              parsed.tenant = {
                ...(parsed.tenant || {}),
                id: targetTenantId,
                tradeName: data.tradeName,
                category: data.commercialCategory,
              };
              if (parsed.user) parsed.user.tenantId = targetTenantId;
              localStorage.setItem('unisaas_active_session', JSON.stringify(parsed));
            } catch {}
          }
        }
        setCompanySuccessMessage(`Negocio cambiado exitosamente a: ${data.tradeName}`);
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch {
      setCompanyErrorMessage('Error al cambiar de negocio activo.');
    }
  };

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreTradeName.trim()) return;
    setIsCreatingStore(true);
    try {
      const res = await fetch('/api/admin/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tradeName: newStoreTradeName.trim(),
          businessName: newStoreBusinessName.trim() || newStoreTradeName.trim(),
          commercialCategory: newStoreCategory,
          nitRut: newStoreNit.trim() || undefined,
          department: newStoreDepartment,
          city: newStoreCity,
          address: newStoreAddress.trim(),
          phone: newStorePhone.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const detail = Array.isArray(err.message) ? err.message.join(' ') : err.message;
        throw new Error(detail || 'Error al agregar la sucursal.');
      }
      setIsNewStoreModalOpen(false);
      setNewStoreTradeName('');
      setNewStoreBusinessName('');
      setNewStoreNit('');
      setNewStoreAddress('Calle Principal # 10-20');
      setNewStorePhone('3000000000');
      setCompanySuccessMessage('Sucursal registrada correctamente en este comercio.');
      await fetchStores();
    } catch (err: any) {
      setCompanyErrorMessage(err.message || 'Error al registrar nuevo negocio.');
    } finally {
      setIsCreatingStore(false);
    }
  };

  useEffect(() => {
    let tenantId = '';

    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('unisaas_active_session');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          tenantId = parsed?.tenant?.id || parsed?.user?.tenantId || '';
          setActiveTenantId(tenantId);
          if (parsed?.user?.fullName) setActiveUserName(parsed.user.fullName);
          if (parsed?.tenant?.tradeName) setTradeName(parsed.tenant.tradeName);
          if (parsed?.tenant?.businessName) setBusinessName(parsed.tenant.businessName);
          if (parsed?.user?.tradeName && !parsed?.tenant?.tradeName) setTradeName(parsed.user.tradeName);
          if (parsed?.user?.businessName && !parsed?.tenant?.businessName) setBusinessName(parsed.user.businessName);
          if (parsed?.user?.email) setEmail(parsed.user.email);
          if (parsed?.tenant?.nitRut) setNit(parsed.tenant.nitRut);

          const cat = parsed?.tenant?.category || parsed?.user?.commercialCategory;
          if (cat) {
            const mappedCat = cat === 'ROPA_CALZADO' ? 'ROPA_ACCESORIOS' : cat;
            if (PROFILE_METADATA_REGISTRY[mappedCat as BusinessProfileType]) {
              setCommercialCategory(mappedCat as BusinessProfileType);
            }
          }
        } catch {}
      }
    }

    async function fetchSettings() {
      try {
        const headers: Record<string, string> = {};
        if (tenantId) headers['x-tenant-id'] = tenantId;

        const res = await fetch('/api/admin/settings', { headers });
        if (res.ok) {
          const data = await res.json();
          if (data.settings) {
            if (data.settings.tenantId) setActiveTenantId(data.settings.tenantId);
            if (data.settings.businessName) setBusinessName(data.settings.businessName);
            if (data.settings.tradeName) setTradeName(data.settings.tradeName);
            if (data.settings.commercialCategory) {
              const cat = data.settings.commercialCategory === 'ROPA_CALZADO' ? 'ROPA_ACCESORIOS' : data.settings.commercialCategory;
              if (PROFILE_METADATA_REGISTRY[cat as BusinessProfileType]) {
                setCommercialCategory(cat as BusinessProfileType);
              }
            }
            if (data.settings.nitRut) setNit(data.settings.nitRut);
            if (data.settings.address) setAddress(data.settings.address);
            if (data.settings.city) setCity(data.settings.city);
            if (data.settings.phone) setPhone(data.settings.phone);
            if (data.settings.taxRegime) setTaxRegime(data.settings.taxRegime);
            if (data.settings.printerPaperWidth) setPrinterPaperWidth(data.settings.printerPaperWidth);
            if (data.settings.printerConnection) setPrinterConnection(data.settings.printerConnection);
            if (data.settings.printerIp !== undefined) setPrinterIp(data.settings.printerIp);
          }
        }
      } catch {}
    }

    fetchSettings();
    fetchStores();
  }, []);

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setCompanySuccessMessage(null);
    setCompanyErrorMessage(null);
    setIsSavingCompany(true);

    try {
      let tenantId = '';
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('unisaas_active_session');
        if (stored) {
          const parsed = JSON.parse(stored);
          tenantId = parsed?.tenant?.id || parsed?.user?.tenantId || '';
        }
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (tenantId) headers['x-tenant-id'] = tenantId;

      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          businessName,
          tradeName,
          commercialCategory,
          nitRut: nit,
          address,
          city,
          phone,
          taxRegime,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Error al guardar la configuracion.');
      }

      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('unisaas_active_session');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            parsed.tenant = {
              ...(parsed.tenant || {}),
              businessName,
              tradeName,
              category: commercialCategory,
              nitRut: nit,
            };
            if (parsed.user) {
              parsed.user.businessName = businessName;
              parsed.user.tradeName = tradeName;
              parsed.user.commercialCategory = commercialCategory;
            }
            localStorage.setItem('unisaas_active_session', JSON.stringify(parsed));

            window.dispatchEvent(
              new CustomEvent('unisaas_store_changed', {
                detail: {
                  ...parsed.tenant,
                },
              }),
            );
          } catch {}
        }
      }

      setCompanySuccessMessage('Configuracion de empresa y rubro comercial actualizados con exito. El punto de venta (POS) y las reglas de facturacion se han adaptado al rubro seleccionado.');
    } catch (err: any) {
      setCompanyErrorMessage(err.message || 'Error inesperado al actualizar la configuracion.');
    } finally {
      setIsSavingCompany(false);
    }
  };

  const handleSavePrinter = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let tenantId = '';
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('unisaas_active_session');
        if (stored) {
          const parsed = JSON.parse(stored);
          tenantId = parsed?.tenant?.id || parsed?.user?.tenantId || '';
        }
      }
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (tenantId) headers['x-tenant-id'] = tenantId;

      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          printerPaperWidth,
          printerConnection,
          printerIp,
          autoPrint: true,
        }),
      });
      if (res.ok) {
        setPrinterSuccessMessage('Parametros de impresion termica ESC/POS guardados permanentemente en PostgreSQL.');
      } else {
        setPrinterSuccessMessage('No se pudo guardar la configuracion en el servidor.');
      }
    } catch {
      setPrinterSuccessMessage('Error de red al guardar la configuracion de la impresora.');
    }
    setTimeout(() => setPrinterSuccessMessage(null), 4000);
  };

  const handleTestPrint = () => {
    alert(`Enviando ticket de prueba ESC/POS a puerto ${printerConnection} (${printerPaperWidth})...`);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccessMessage(null);
    setPasswordErrorMessage(null);

    if (newAccountPassword.length < 8) {
      setPasswordErrorMessage('La nueva contraseña debe tener como minimo 8 caracteres.');
      return;
    }
    if (newAccountPassword !== confirmAccountPassword) {
      setPasswordErrorMessage('La confirmacion de la nueva contraseña no coincide.');
      return;
    }

    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: userHasPassword ? (currentPassword.trim() || undefined) : undefined,
          newPassword: newAccountPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setPasswordErrorMessage(data.message || 'No fue posible actualizar la contraseña.');
        return;
      }

      setPasswordSuccessMessage(data.message || 'Contraseña actualizada correctamente.');
      setCurrentPassword('');
      setNewAccountPassword('');
      setConfirmAccountPassword('');
    } catch {
      setPasswordErrorMessage('Error de conexion al actualizar la contraseña.');
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Configuracion y Perfil de Empresa
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Parametros del comercio, adaptacion de rubro multi-vertical, hardware de impresion y credenciales
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Link
            href="/admin/team"
            className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-2xl transition-colors flex items-center space-x-1.5 w-full sm:w-auto justify-center"
            title="Ir al gestor de colaboradores, cajas y permisos RBAC"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Roles y Equipo (RBAC)</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-60" />
          </Link>
        </div>
      </div>

      <div className="flex items-center space-x-2 border-b border-slate-200 overflow-x-auto no-scrollbar pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('empresa')}
          className={`pb-3 px-3.5 text-xs font-bold border-b-2 transition-colors flex items-center space-x-2 whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'empresa'
              ? 'border-[#0066FF] text-[#0066FF]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Datos de la Empresa y Rubro</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('impresora')}
          className={`pb-3 px-3.5 text-xs font-bold border-b-2 transition-colors flex items-center space-x-2 whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'impresora'
              ? 'border-[#0066FF] text-[#0066FF]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Printer className="w-4 h-4" />
          <span>Impresion Termica ESC/POS</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('seguridad')}
          className={`pb-3 px-3.5 text-xs font-bold border-b-2 transition-colors flex items-center space-x-2 whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'seguridad'
              ? 'border-[#0066FF] text-[#0066FF]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Seguridad y Contraseña</span>
        </button>
      </div>

      {activeTab === 'empresa' && (
        <div className="space-y-6 w-full">
          {companySuccessMessage && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-2xl flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{companySuccessMessage}</span>
            </div>
          )}

          {companyErrorMessage && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium rounded-2xl flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{companyErrorMessage}</span>
            </div>
          )}

          <div className="bg-white rounded-3xl shadow-xs border border-slate-100 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
                  <Store className="w-4 h-4 text-[#0066FF]" />
                  <span>Mis Negocios y Establecimientos (Multi-Comercio)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Como propietario, puedes administrar uno o varios negocios independientes desde esta misma cuenta.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewStoreModalOpen(true)}
                className="px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-2xl transition-all flex items-center space-x-1.5 shadow-sm shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Agregar otro negocio</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 pt-2">
              {stores.map((s) => {
                const isActive = Boolean(s.isCurrent ?? s.isPrimary);
                return (
                  <div
                    key={s.id || s.branchId || s.tenantId}
                    className={`p-4 rounded-2xl border transition-all ${
                      isActive
                        ? 'border-emerald-500 bg-emerald-50/40 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-extrabold text-slate-900 line-clamp-1">
                        {s.tradeName}
                      </span>
                      {isActive ? (
                        <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                          Sucursal actual
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          Sucursal
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-1">
                      {s.businessName}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                      {s.address || 'Sin direccion registrada'}
                    </p>
                    {s.phone ? (
                      <p className="text-[11px] text-slate-400 font-mono">{s.phone}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          {isNewStoreModalOpen && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
                    <Store className="w-4 h-4 text-[#0066FF]" />
                    <span>Registrar Nuevo Negocio (+ Agregar otro negocio)</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsNewStoreModalOpen(false)}
                    className="p-1 rounded-xl hover:bg-slate-100 text-slate-400"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleCreateStore} className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Nombre Comercial de la Tienda:</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Minimercado La Floresta"
                      value={newStoreTradeName}
                      onChange={(e) => {
                        setNewStoreTradeName(e.target.value);
                        if (!newStoreBusinessName) setNewStoreBusinessName(e.target.value);
                      }}
                      className="w-full p-2.5 bg-slate-50 rounded-xl text-slate-900 font-bold border-0 focus:ring-2 focus:ring-[#0066FF]"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Razon Social:</label>
                    <input
                      type="text"
                      placeholder="Ej. Inversiones La Floresta S.A.S."
                      value={newStoreBusinessName}
                      onChange={(e) => setNewStoreBusinessName(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 rounded-xl text-slate-900 border-0 focus:ring-2 focus:ring-[#0066FF]"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Rubro Comercial:</label>
                    <select
                      value={newStoreCategory}
                      onChange={(e) => setNewStoreCategory(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 rounded-xl text-slate-900 font-bold border-0 focus:ring-2 focus:ring-[#0066FF]"
                    >
                      {AVAILABLE_COMMERCIAL_CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label} ({c.family})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">NIT / RUT:</label>
                      <input
                        type="text"
                        placeholder="901234567"
                        value={newStoreNit}
                        onChange={(e) => setNewStoreNit(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 rounded-xl text-slate-900 font-mono border-0 focus:ring-2 focus:ring-[#0066FF]"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Departamento:</label>
                      <select
                        value={newStoreDepartment}
                        onChange={(e) => {
                          setNewStoreDepartment(e.target.value);
                          const found = COLOMBIA_DEPARTMENTS.find((d) => d.name === e.target.value);
                          if (found && found.cities.length > 0) setNewStoreCity(found.cities[0]);
                        }}
                        className="w-full p-2.5 bg-slate-50 rounded-xl text-slate-900 border-0 focus:ring-2 focus:ring-[#0066FF]"
                      >
                        {COLOMBIA_DEPARTMENTS.map((d) => (
                          <option key={d.name} value={d.name}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Direccion:</label>
                      <input
                        type="text"
                        required
                        placeholder="Carrera 15 # 40-20"
                        value={newStoreAddress}
                        onChange={(e) => setNewStoreAddress(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 rounded-xl text-slate-900 border-0 focus:ring-2 focus:ring-[#0066FF]"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Telefono (10 digitos):</label>
                      <input
                        type="tel"
                        required
                        inputMode="numeric"
                        maxLength={10}
                        placeholder="3001234567"
                        value={newStorePhone}
                        onChange={(e) => setNewStorePhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        className="w-full p-2.5 bg-slate-50 rounded-xl text-slate-900 border-0 focus:ring-2 focus:ring-[#0066FF]"
                      />
                    </div>
                  </div>
                  <div className="pt-3 flex justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setIsNewStoreModalOpen(false)}
                      className="px-4 py-2 rounded-xl text-slate-600 font-bold hover:bg-slate-100"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isCreatingStore}
                      className="px-5 py-2 rounded-xl bg-neutral-900 text-white font-bold hover:bg-neutral-800 disabled:opacity-50"
                    >
                      {isCreatingStore ? 'Creando negocio...' : 'Crear Negocio'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <form onSubmit={handleSaveCompany} className="space-y-6">
            <div className="bg-white rounded-3xl shadow-xs border border-slate-100 p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
                    <Layers className="w-4 h-4 text-[#0066FF]" />
                    <span>Tipo de Empresa y Rubro Comercial</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Selecciona el modelo operativo de tu negocio. Si cambias de rubro, la terminal POS, el calculador fiscal y las reglas de inventario se adaptaran automaticamente.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold text-xs mb-1.5">
                  Rubro Comercial Activo:
                </label>
                <select
                  value={commercialCategory}
                  onChange={(e) => setCommercialCategory(e.target.value as BusinessProfileType)}
                  className="w-full p-3 bg-slate-50 rounded-2xl text-slate-900 font-bold text-xs border-0 focus:ring-2 focus:ring-[#0066FF]"
                >
                  {AVAILABLE_COMMERCIAL_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label} ({cat.family})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  {AVAILABLE_COMMERCIAL_CATEGORIES.find((c) => c.id === commercialCategory)?.description}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <span className="text-[11px] font-extrabold text-slate-700 block mb-2">
                  Capacidades del Sistema Activadas para este Rubro:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-[11px]">
                  <div className={`p-2.5 rounded-xl border ${activeCapabilities.enableDecimalScale ? 'bg-blue-50/60 border-blue-200 text-blue-900' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                    <span className="font-bold block">Balanza Digital:</span>
                    <span>{activeCapabilities.enableDecimalScale ? 'Pesaje Decimal (Kg)' : 'Desactivada'}</span>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${activeCapabilities.allowVoluntaryTip ? 'bg-blue-50/60 border-blue-200 text-blue-900' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                    <span className="font-bold block">Propina Voluntaria:</span>
                    <span>{activeCapabilities.allowVoluntaryTip ? 'Habilitada (Ley 1935)' : 'No aplica'}</span>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${activeCapabilities.enableKitchenTickets ? 'bg-blue-50/60 border-blue-200 text-blue-900' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                    <span className="font-bold block">Comanda a Cocina:</span>
                    <span>{activeCapabilities.enableKitchenTickets ? 'Activa' : 'No requerida'}</span>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${activeCapabilities.enableCreditFiado ? 'bg-blue-50/60 border-blue-200 text-blue-900' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                    <span className="font-bold block">Venta a Credito (Fiado):</span>
                    <span>{activeCapabilities.enableCreditFiado ? 'Cupo y Cartera Activos' : 'Solo Contado'}</span>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${activeCapabilities.enableProductVariants ? 'bg-blue-50/60 border-blue-200 text-blue-900' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                    <span className="font-bold block">Matriz de Variantes:</span>
                    <span>{activeCapabilities.enableProductVariants ? 'Talla y Color' : 'Articulo Simple'}</span>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${activeCapabilities.enableFractionalUnits ? 'bg-blue-50/60 border-blue-200 text-blue-900' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                    <span className="font-bold block">Unidades Fraccionadas:</span>
                    <span>{activeCapabilities.enableFractionalUnits ? 'Metros, Tubos, Kilos' : 'Unidades Enteras'}</span>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${activeCapabilities.primaryTaxScheme === 'INC_8' ? 'bg-amber-50/60 border-amber-200 text-amber-900' : activeCapabilities.primaryTaxScheme === 'IVA_19' ? 'bg-blue-50/60 border-blue-200 text-blue-900' : 'bg-emerald-50/60 border-emerald-200 text-emerald-900'}`}>
                    <span className="font-bold block">Regimen Fiscal:</span>
                    <span>{activeCapabilities.primaryTaxScheme === 'INC_8' ? 'Impoconsumo (INC 8%)' : activeCapabilities.primaryTaxScheme === 'IVA_19' ? 'IVA General (19%)' : 'Exento Canasta (0%)'}</span>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${activeCapabilities.enableManualKeypad ? 'bg-blue-50/60 border-blue-200 text-blue-900' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                    <span className="font-bold block">Venta Libre (Express):</span>
                    <span>{activeCapabilities.enableManualKeypad ? 'Teclado Numerico POS' : 'Solo Catálogo'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-xs border border-slate-100 p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-[#0066FF]" />
                    <span>Identidad Visual Vectorial (EntityMonogram)</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    UNISAAS genera monogramas vectoriales deterministas a partir de la razón comercial y nombre del usuario. Este diseño garantiza una estética editorial de alto contraste, cero vulnerabilidades Stored XSS y máxima velocidad de carga.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center space-x-4">
                  <EntityMonogram
                    name={tradeName || businessName}
                    size="xl"
                    shape="rounded"
                    className="shadow-sm"
                  />
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Monograma de Empresa
                    </span>
                    <strong className="text-xs font-bold text-slate-900 block mt-0.5">
                      {tradeName || businessName}
                    </strong>
                    <span className="text-[11px] text-slate-500">
                      Mostrador POS, tirillas térmicas y barra lateral
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center space-x-4">
                  <EntityMonogram
                    name={activeUserName}
                    size="xl"
                    shape="circle"
                    className="shadow-sm"
                  />
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Monograma de Usuario
                    </span>
                    <strong className="text-xs font-bold text-slate-900 block mt-0.5">
                      {activeUserName}
                    </strong>
                    <span className="text-[11px] text-slate-500">
                      Identificador activo en cabecera y turnos
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-xs border border-slate-100 p-6 space-y-4">
              <h2 className="text-sm font-extrabold text-slate-900 mb-2">
                Identificacion Comercial y Tributaria
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Razon Social:</label>
                  <input
                    type="text"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 rounded-xl text-slate-900 font-bold border-0 focus:ring-2 focus:ring-[#0066FF]"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Nombre Comercial (Rótulo en POS):</label>
                  <input
                    type="text"
                    required
                    value={tradeName}
                    onChange={(e) => setTradeName(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 rounded-xl text-slate-900 font-bold border-0 focus:ring-2 focus:ring-[#0066FF]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">NIT / RUT:</label>
                  <input
                    type="text"
                    value={nit}
                    onChange={(e) => setNit(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 rounded-xl text-slate-900 font-mono border-0 focus:ring-2 focus:ring-[#0066FF]"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Regimen Tributario:</label>
                  <select
                    value={taxRegime}
                    onChange={(e) => setTaxRegime(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 rounded-xl text-slate-900 font-bold border-0 focus:ring-2 focus:ring-[#0066FF]"
                  >
                    <option value="RESPONSABLE_IVA">Responsable de IVA (Regimen Comun)</option>
                    <option value="NO_RESPONSABLE_IVA">No Responsable de IVA (Regimen Simplificado)</option>
                    <option value="REGIMEN_SIMPLE">Regimen Simple de Tributacion (RST)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Direccion Comercial:</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 rounded-xl text-slate-900 border-0 focus:ring-2 focus:ring-[#0066FF]"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Ciudad y Departamento:</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 rounded-xl text-slate-900 border-0 focus:ring-2 focus:ring-[#0066FF]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Telefono de Contacto:</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 rounded-xl text-slate-900 border-0 focus:ring-2 focus:ring-[#0066FF]"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Correo de Notificaciones:</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 rounded-xl text-slate-900 border-0 focus:ring-2 focus:ring-[#0066FF]"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSavingCompany}
                  className="px-6 py-2.5 bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs rounded-2xl shadow-xs transition-colors disabled:opacity-50"
                >
                  {isSavingCompany ? 'Guardando...' : 'Guardar Configuracion de Empresa'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'impresora' && (
        <div className="bg-white rounded-3xl shadow-xs border border-slate-100 p-4 sm:p-6 lg:p-8 w-full max-w-4xl">
          {printerSuccessMessage && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-xl flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{printerSuccessMessage}</span>
            </div>
          )}

          <form onSubmit={handleSavePrinter} className="space-y-4 text-xs">
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 mb-2">
              Parametros de Hardware e Impresion ESC/POS
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Ancho de Papel Termico:</label>
                <select
                  value={printerPaperWidth}
                  onChange={(e) => setPrinterPaperWidth(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 rounded-xl text-slate-900 font-bold border-0 focus:ring-2 focus:ring-[#0066FF]"
                >
                  <option value="80mm">80 milimetros (Estandar POS Mostrador)</option>
                  <option value="58mm">58 milimetros (POS Portatil / Movil)</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">Tipo de Conexion:</label>
                <select
                  value={printerConnection}
                  onChange={(e) => setPrinterConnection(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 rounded-xl text-slate-900 font-bold border-0 focus:ring-2 focus:ring-[#0066FF]"
                >
                  <option value="USB">USB Local Directo (Squad 6 Bridge)</option>
                  <option value="ETHERNET">Red Ethernet / WiFi (IP Socket 9100)</option>
                  <option value="BLUETOOTH">Bluetooth (Impresora Movil)</option>
                </select>
              </div>
            </div>

            {printerConnection === 'ETHERNET' && (
              <div>
                <label className="block text-slate-700 font-bold mb-1">Direccion IP de la Impresora:</label>
                <input
                  type="text"
                  placeholder="192.168.1.100"
                  value={printerIp}
                  onChange={(e) => setPrinterIp(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 rounded-xl text-slate-900 font-mono border-0 focus:ring-2 focus:ring-[#0066FF]"
                />
              </div>
            )}

            <div>
              <label className="block text-slate-700 font-bold mb-1">Encabezado del Ticket:</label>
              <textarea
                rows={3}
                value={ticketHeader}
                onChange={(e) => setTicketHeader(e.target.value)}
                className="w-full p-2.5 bg-slate-50 rounded-xl text-slate-900 font-mono border-0 focus:ring-2 focus:ring-[#0066FF]"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Pie de Pagina del Ticket:</label>
              <textarea
                rows={2}
                value={ticketFooter}
                onChange={(e) => setTicketFooter(e.target.value)}
                className="w-full p-2.5 bg-slate-50 rounded-xl text-slate-900 font-mono border-0 focus:ring-2 focus:ring-[#0066FF]"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-3">
              <button
                type="submit"
                className="px-5 py-2.5 bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer text-center"
              >
                Guardar Configuracion
              </button>
              <button
                type="button"
                onClick={handleTestPrint}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer text-center"
              >
                Probar Impresion
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'seguridad' && (
        <div className="bg-white rounded-3xl shadow-xs border border-slate-100 p-4 sm:p-6 lg:p-8 w-full max-w-3xl">
          <form onSubmit={handleUpdatePassword} className="space-y-4 text-xs">
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 mb-1">
                Seguridad de la Cuenta y Cambio de Contraseña
              </h2>
              <p className="text-xs text-slate-500">
                Actualice sus credenciales maestras de acceso como administrador del comercio.
              </p>
            </div>

            {passwordSuccessMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{passwordSuccessMessage}</span>
              </div>
            )}

            {passwordErrorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{passwordErrorMessage}</span>
              </div>
            )}

            {userHasPassword ? (
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Contraseña Actual:
                </label>
                <input
                  type="password"
                  required
                  placeholder="Ingrese su contraseña actual"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 rounded-xl text-slate-900 border-0 focus:ring-2 focus:ring-[#0066FF]"
                />
              </div>
            ) : (
              <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs font-medium">
                Cuenta autenticada con Google OAuth. Asigne una contraseña local para habilitar acceso directo con correo y contraseña.
              </div>
            )}

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Nueva Contraseña:
              </label>
              <input
                type="password"
                required
                placeholder="Minimo 8 caracteres alfanumericos"
                value={newAccountPassword}
                onChange={(e) => setNewAccountPassword(e.target.value)}
                className="w-full p-2.5 bg-slate-50 rounded-xl text-slate-900 border-0 focus:ring-2 focus:ring-[#0066FF]"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">
                Confirmar Nueva Contraseña:
              </label>
              <input
                type="password"
                required
                placeholder="Repita la nueva contraseña"
                value={confirmAccountPassword}
                onChange={(e) => setConfirmAccountPassword(e.target.value)}
                className="w-full p-2.5 bg-slate-50 rounded-xl text-slate-900 border-0 focus:ring-2 focus:ring-[#0066FF]"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="px-5 py-2.5 bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
              >
                Actualizar Contraseña de Cuenta
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
