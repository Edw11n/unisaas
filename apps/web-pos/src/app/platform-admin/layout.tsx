'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ShieldCheck,
  Building,
  Server,
  CreditCard,
  Activity,
  LogOut,
  Store,
  Search,
  Bell,
  Menu,
  X,
  ExternalLink,
} from 'lucide-react';

const navItems = [
  { label: 'Empresas y Tenants', href: '/platform-admin', tab: 'tenants', icon: Building },
  { label: 'Salud Microservicios', href: '/platform-admin?tab=squads', tab: 'squads', icon: Server },
  { label: 'Planes y Tarifas SaaS', href: '/platform-admin?tab=planes', tab: 'planes', icon: CreditCard },
  { label: 'Auditoria Forense', href: '/platform-admin?tab=auditoria', tab: 'auditoria', icon: ShieldCheck },
];

interface PlatformNotification {
  id: string;
  title: string;
  detail: string;
  actor: string;
  target?: string | null;
  createdAt: string;
}

const AUDIT_LABELS: Record<string, string> = {
  PLATFORM_LOGIN: 'Inicio de sesion del superadmin',
  TENANT_PROVISION: 'Empresa creada',
  TENANT_UPDATE: 'Empresa actualizada',
  TENANT_SUSPEND: 'Empresa suspendida',
  TENANT_ACTIVATE: 'Empresa reactivada',
  TENANT_SOFT_DELETE: 'Empresa eliminada',
  TENANT_HARD_DELETE: 'Empresa eliminada definitivamente',
  OWNER_PASSWORD_RESET: 'Contrasena de owner restablecida',
};

function formatNotificationDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || 'Sin fecha';
  return date.toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function PlatformAdminSidebarNav({ isSidebarHovered }: { isSidebarHovered: boolean }) {
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab') || 'tenants';

  return (
    <nav className="flex-1 flex flex-col justify-between overflow-y-auto px-2.5 py-4 custom-scrollbar">
      <div className="space-y-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.tab;
          return (
            <Link
              key={item.label}
              href={item.href}
              title={item.label}
              className={`w-full flex items-center rounded-2xl text-xs font-semibold transition-all ${
                isSidebarHovered ? 'px-3.5 py-2.5 justify-between' : 'p-2.5 justify-center'
              } ${
                isActive
                  ? 'bg-[#18668F] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center space-x-3 min-w-0">
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                {isSidebarHovered && (
                  <span className="truncate whitespace-nowrap animate-in fade-in duration-150">
                    {item.label}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function PlatformAdminMobileNav({ onClose }: { onClose: () => void }) {
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab') || 'tenants';

  return (
    <nav className="space-y-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentTab === item.tab;
        return (
          <Link
            key={item.label}
            href={item.href}
            onClick={onClose}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold ${
              isActive
                ? 'bg-[#18668F] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}


function PlatformAdminHeaderSearch() {
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState('');

  useEffect(() => {
    setSearchValue(searchParams.get('q') || '');
  }, [searchParams]);

  useEffect(() => {
    const handleSync = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      setSearchValue(customEvent.detail || '');
    };
    window.addEventListener('platform-admin-search-sync', handleSync);
    return () => window.removeEventListener('platform-admin-search-sync', handleSync);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchValue(val);

    window.dispatchEvent(new CustomEvent('platform-admin-search', { detail: val }));

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (val.trim()) {
        params.set('q', val);
      } else {
        params.delete('q');
      }
      const newQuery = params.toString();
      const newUrl = `${window.location.pathname}${newQuery ? `?${newQuery}` : ''}`;
      window.history.replaceState(null, '', newUrl);
    }
  };

  const handleClear = () => {
    setSearchValue('');
    window.dispatchEvent(new CustomEvent('platform-admin-search', { detail: '' }));
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      params.delete('q');
      const newQuery = params.toString();
      const newUrl = `${window.location.pathname}${newQuery ? `?${newQuery}` : ''}`;
      window.history.replaceState(null, '', newUrl);
    }
  };

  return (
    <div className="relative w-72 sm:w-96">
      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
      <input
        type="text"
        placeholder="Buscar empresa, NIT o ID de tenant..."
        value={searchValue}
        onChange={handleChange}
        className="w-full pl-10 pr-9 py-2 bg-[#F3F5F9] border-0 rounded-2xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#18668F]"
      />
      {searchValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-full"
          title="Limpiar busqueda"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export default function PlatformAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<PlatformNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [hasUnread, setHasUnread] = useState(true);

  const loadPlatformNotifications = async () => {
    setNotificationsLoading(true);
    setNotificationsError(null);
    try {
      const res = await fetch('/api/platform/audit', { cache: 'no-store' });
      if (res.status === 401) {
        window.location.href = '/login?from=/platform-admin';
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'No se pudo cargar la auditoria.');
      }
      const events = Array.isArray(data.audit) ? data.audit : [];
      setNotifications(
        events.slice(0, 12).map((event: any) => ({
          id: String(event.id || `${event.action}-${event.createdAt}`),
          title: AUDIT_LABELS[event.action] || String(event.action || 'Evento de plataforma'),
          detail:
            event.details && typeof event.details === 'object'
              ? JSON.stringify(event.details)
              : String(event.details || ''),
          actor: String(event.adminEmail || event.admin_email || 'Superadmin'),
          target: event.targetEmail || event.target_email || event.targetTenantId || event.target_tenant_id,
          createdAt: String(event.createdAt || event.created_at || ''),
        })),
      );
    } catch (error: any) {
      setNotificationsError(error?.message || 'Error al cargar notificaciones.');
    } finally {
      setNotificationsLoading(false);
    }
  };

  const toggleNotifications = () => {
    const next = !notificationsOpen;
    setNotificationsOpen(next);
    if (next) {
      setHasUnread(false);
      void loadPlatformNotifications();
    }
  };

  useEffect(() => {
    if (!notificationsOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNotificationsOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [notificationsOpen]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Continuar con navegacion si la red falla
    }
    if (typeof window !== 'undefined') {
      localStorage.clear();
      sessionStorage.clear();
      document.cookie = 'unisaas_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0;';
      document.cookie = 'unisaas_access_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0;';
      document.cookie = 'unisaas_refresh=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Max-Age=0;';
      window.location.href = '/login?logout=true';
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F3F5F9] flex flex-col md:flex-row font-sans text-slate-800">
      {/* Barra Superior Movil */}
      <div className="md:hidden flex items-center justify-between px-5 py-3.5 bg-white border-b border-slate-200">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#18668F] text-white flex items-center justify-center font-black text-xs shrink-0 select-none">PA</div>
          <span className="font-extrabold text-xl tracking-tight text-slate-900">
            UNISAAS Platform
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-600 hover:text-slate-900 rounded-xl bg-slate-100"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Drawer Movil */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex">
          <div className="w-72 bg-white h-full p-5 flex flex-col justify-between shadow-2xl">
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-lg bg-[#18668F] text-white flex items-center justify-center font-black text-xs shrink-0 select-none">PA</div>
                  <span className="font-extrabold text-lg text-slate-900">UNISAAS Root</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <Suspense fallback={<nav className="space-y-1" />}>
                <PlatformAdminMobileNav onClose={() => setMobileMenuOpen(false)} />
              </Suspense>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-2">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center space-x-2.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl"
              >
                <LogOut className="w-4 h-4" />
                <span>Cerrar Sesion</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar de Escritorio Invo (Fijo y Colapsable) */}
      <aside
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => setIsSidebarHovered(false)}
        className={`hidden md:flex flex-col fixed top-0 left-0 bottom-0 z-30 h-screen bg-white/95 backdrop-blur-md border-r border-slate-200/80 shadow-xs transition-all duration-300 ease-in-out group ${
          isSidebarHovered ? 'w-64 shadow-xl' : 'w-20'
        }`}
      >
        <div className="shrink-0 p-4 border-b border-slate-100/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#18668F] text-white flex items-center justify-center font-black text-sm shrink-0 select-none">PA</div>
            <div
              className={`flex flex-col min-w-0 transition-opacity duration-200 ${
                isSidebarHovered
                  ? 'opacity-100'
                  : 'opacity-0 w-0 h-0 overflow-hidden pointer-events-none'
              }`}
            >
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg tracking-tight text-slate-900">
                  UNISAAS
                </span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-wider bg-blue-50 text-[#18668F] border border-blue-100 uppercase">
                  ROOT
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium truncate">Consola de Plataforma</p>
            </div>
          </div>
        </div>

        {/* Navegacion Principal */}
        <Suspense fallback={<nav className="flex-1 px-2.5 py-4 space-y-1" />}>
          <PlatformAdminSidebarNav isSidebarHovered={isSidebarHovered} />
        </Suspense>

        {/* Zona Inferior: Logout Root */}
        <div className="mt-auto pt-2 space-y-1.5 shrink-0 p-3 border-t border-slate-100">
          <button
            type="button"
            onClick={handleLogout}
            title="Cerrar Sesion Root"
            className={`w-full flex items-center rounded-2xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-all cursor-pointer ${
              isSidebarHovered ? 'px-3.5 py-2.5 justify-start space-x-3' : 'p-2.5 justify-center'
            }`}
          >
            <LogOut className="w-5 h-5 text-rose-500 shrink-0" />
            {isSidebarHovered && (
              <span className="truncate whitespace-nowrap animate-in fade-in duration-150 font-bold">
                Cerrar Sesion Root
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* Contenido Principal con Header Invo */}
      <div className="flex-1 flex flex-col min-w-0 md:ml-20 transition-all duration-300">
        {/* Header Superior Invo */}
        <header className="h-18 bg-white border-b border-slate-200/80 px-6 sm:px-8 flex items-center justify-between shrink-0 sticky top-0 z-20">
          {/* Busqueda Global Reactiva y Sincronizada */}
          <Suspense fallback={
            <div className="relative w-72 sm:w-96">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar empresa, NIT o ID de tenant..."
                disabled
                className="w-full pl-10 pr-4 py-2 bg-[#F3F5F9] border-0 rounded-2xl text-xs text-slate-400"
              />
            </div>
          }>
            <PlatformAdminHeaderSearch />
          </Suspense>

          {/* Acciones y Perfil */}
          <div className="flex items-center space-x-4">
            <div className="relative order-3">
              <button
                type="button"
                onClick={toggleNotifications}
                aria-expanded={notificationsOpen}
                aria-label="Abrir notificaciones de plataforma"
                className={`p-2 rounded-xl relative transition-colors ${
                  notificationsOpen
                    ? 'text-[#18668F] bg-blue-50'
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                }`}
                title="Notificaciones de Plataforma"
              >
                <Bell className="w-4 h-4" />
                {hasUnread ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 absolute top-2 right-2 ring-2 ring-white" />
                ) : null}
              </button>

              {notificationsOpen ? (
                <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                    <div>
                      <div className="text-xs font-extrabold text-slate-900">
                        Notificaciones de plataforma
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Auditoria global reciente
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNotificationsOpen(false)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                      aria-label="Cerrar notificaciones"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="max-h-80 overflow-y-auto">
                    {notificationsLoading ? (
                      <div className="px-4 py-8 text-center text-xs text-slate-500">
                        Cargando notificaciones...
                      </div>
                    ) : notificationsError ? (
                      <div className="px-4 py-6 text-center text-xs text-rose-600">
                        {notificationsError}
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-xs text-slate-500">
                        No hay eventos de plataforma todavia.
                      </div>
                    ) : (
                      notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className="px-4 py-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="text-[11px] font-bold text-slate-800 leading-snug">
                              {notification.title}
                            </div>
                            <div className="text-[9px] text-slate-400 whitespace-nowrap">
                              {formatNotificationDate(notification.createdAt)}
                            </div>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {notification.actor}
                            {notification.target ? ` -> ${notification.target}` : ''}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <Link
                    href="/platform-admin?tab=auditoria"
                    onClick={() => setNotificationsOpen(false)}
                    className="flex items-center justify-between px-4 py-2.5 bg-slate-50 text-[10px] font-bold text-[#18668F] hover:bg-blue-50"
                  >
                    <span>Ver auditoria completa</span>
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ) : null}
            </div>

            <div className="order-2 h-7 w-px bg-slate-200" />

            <div className="order-1 flex items-center space-x-3">
              <div className="hidden sm:block text-right">
                <div className="text-xs font-extrabold text-slate-900 leading-tight">
                  Admin Maestro
                </div>
                <div className="text-[10px] text-slate-500 font-medium">
                  Root Platform Operator
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Body */}
        <main className="flex-1 p-6 sm:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
