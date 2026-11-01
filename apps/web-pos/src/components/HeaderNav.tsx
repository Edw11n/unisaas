'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Store, User, LogOut, RefreshCw } from 'lucide-react';

interface HeaderNavProps {
  user?: {
    fullName: string;
    email: string;
    role: string;
    tenantId: string;
    branchId?: string;
  } | null;
  branchName?: string;
}

export function HeaderNav({ user, branchName = 'Sucursal Principal' }: HeaderNavProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.push('/login');
      router.refresh();
    }
  };

  return (
    <header className="bg-brand-primary text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo y Nombre del Sistema */}
          <div className="flex items-center space-x-3">
            <div className="bg-white/10 p-2 rounded-lg">
              <Store className="w-6 h-6 text-brand-secondary" />
            </div>
            <div>
              <span className="font-heading font-bold text-xl tracking-tight">
                Uni<span className="text-brand-secondary">SaaS</span> POS
              </span>
              <span className="ml-2 text-xs bg-brand-primary-hover px-2 py-0.5 rounded text-gray-200">
                v1.0.0
              </span>
            </div>
          </div>

          {/* Sucursal y Turno */}
          <div className="hidden md:flex items-center space-x-4 bg-brand-primary-hover px-3 py-1.5 rounded-lg text-sm">
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-secondary animate-pulse" />
              <span className="font-medium text-gray-100">{branchName}</span>
            </div>
            <span className="text-gray-400">|</span>
            <span className="text-xs text-gray-300">Turno Activo</span>
          </div>

          {/* Usuario y Logout */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm text-gray-100">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <div className="hidden sm:block text-left">
                <p className="font-medium leading-none">{user?.fullName || 'Cajero'}</p>
                <p className="text-xs text-gray-300 mt-0.5">{user?.role || 'CASHIER'}</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 rounded-lg hover:bg-white/10 text-gray-200 hover:text-white transition-colors"
              title="Cerrar Sesión"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

