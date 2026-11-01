'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminCreditsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/clients');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="text-center space-y-2">
        <p className="text-sm font-bold text-slate-700">Redirigiendo a Clientes y Cartera...</p>
        <p className="text-xs text-slate-400">Módulo unificado conectado a PostgreSQL y Squad 7.</p>
      </div>
    </div>
  );
}

