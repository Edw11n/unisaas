'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  LogOut,
  Store,
  Menu,
  X,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { SAAS_NAVIGATION_ITEMS } from '@/lib/navigation';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sessionUser, setSessionUser] = useState<{
    fullName: string;
    role: string;
    tenantName: string;
    email: string;
  }>({
    fullName: 'Administrador',
    role: 'OWNER',
    tenantName: 'Mi Negocio UniSaaS',
    email: 'admin@unisaas.com',
  });

  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch('/api/auth/session');
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setSessionUser({
              fullName: data.user.fullName || 'Administrador',
              role: data.user.role || 'OWNER',
              tenantName: data.user.tradeName || 'Mi Negocio UniSaaS',
              email: data.user.email || '',
            });
          }
        }
      } catch {}
    }
    fetchSession();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.push('/login');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row text-slate-800">
      {/* Mobile Header */}
      <header className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center space-x-2">
          <span className="text-xl font-black text-sky-700">UniSaaS</span>
          <span className="text-[10px] font-bold text-slate-500 uppercase px-1.5 py-0.5 bg-slate-100 rounded">
            Admin
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <Link
            href="/pos"
            className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center space-x-1"
          >
            <Store className="w-3.5 h-3.5" />
            <span>POS</span>
          </Link>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Sidebar Desktop */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white flex flex-col justify-between transform transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-0 -translate-x-full lg:translate-x-0'
        }`}
      >
        <div>
          {/* Brand */}
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-black tracking-tight text-white">UniSaaS</span>
                <span className="text-[10px] font-bold text-sky-400 bg-sky-950 border border-sky-800 px-1.5 py-0.5 rounded">
                  Admin Pro
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate mt-1 max-w-[190px]">
                {sessionUser.tenantName}
              </p>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Access to POS */}
          <div className="p-3">
            <Link
              href="/pos"
              className="w-full py-2.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs flex items-center justify-between shadow-sm transition"
            >
              <div className="flex items-center space-x-2">
                <Store className="w-4 h-4" />
                <span>Abrir Mostrador POS</span>
              </div>
              <ChevronRight className="w-4 h-4 opacity-75" />
            </Link>
          </div>

          {/* Navigation Items */}
          <nav className="px-3 py-2 space-y-0.5 overflow-y-auto max-h-[calc(100vh-260px)]">
            {SAAS_NAVIGATION_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-semibold transition ${
                    isActive
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-sky-700 flex items-center justify-center font-bold text-xs text-white uppercase flex-shrink-0">
                {sessionUser.fullName.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{sessionUser.fullName}</p>
                <div className="flex items-center space-x-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px] text-slate-400 uppercase font-mono">{sessionUser.role}</span>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full py-1.5 px-3 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 text-xs font-medium flex items-center justify-center space-x-1.5 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

