import Link from 'next/link';
import { Clock, ArrowRight, ShieldCheck } from 'lucide-react';

export default function RegisterPendingPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 mx-auto flex items-center justify-center">
          <Clock className="w-8 h-8" />
        </div>

        <div>
          <h1 className="text-xl font-black text-slate-900">Registro en Proceso de Activación</h1>
          <p className="text-sm text-slate-500 mt-2">
            Hemos recibido los datos de tu empresa satisfactoriamente. Tu cuenta se encuentra en revisión de seguridad para habilitar el entorno multi-tenant aislado.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-left text-xs text-slate-600 space-y-2">
          <div className="flex items-center space-x-2 font-semibold text-slate-800">
            <ShieldCheck className="w-4 h-4 text-sky-600" />
            <span>Blindaje Multi-Tenant RLS Activo</span>
          </div>
          <p>
            Te notificaremos por correo electrónico una vez tu sede y catálogo queden aprovisionados.
          </p>
        </div>

        <Link
          href="/login"
          className="w-full inline-flex items-center justify-center space-x-2 px-6 py-3 bg-sky-700 hover:bg-sky-800 text-white font-bold rounded-xl text-sm transition"
        >
          <span>Ir a Iniciar Sesión</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

