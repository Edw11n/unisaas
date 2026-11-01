'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { KeyRound, CheckCircle2, AlertCircle, Loader2, ArrowRight } from 'lucide-react';

export default function ActivarColaboradorPage() {
  const router = useRouter();
  const [activationCode, setActivationCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanCode = activationCode.trim().replace(/[^0-9]/g, '');
    if (cleanCode.length !== 6) {
      setError('El código de activación debe contener exactamente 6 dígitos numéricos.');
      return;
    }

    if (password.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: cleanCode,
          newPassword: password,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || 'Código de activación inválido o expirado.');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/pos');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Error al activar cuenta de colaborador.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-6">
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-sky-50 text-sky-700 mx-auto flex items-center justify-center mb-3">
            <KeyRound className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Activar Cuenta de Colaborador</h1>
          <p className="text-xs text-slate-500 mt-1">
            Ingresa el código temporal de 6 dígitos suministrado por el administrador de tu negocio.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div className="p-6 rounded-xl bg-emerald-50 border border-emerald-200 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <h3 className="text-sm font-bold text-emerald-900">¡Cuenta Activada con Éxito!</h3>
            <p className="text-xs text-emerald-700">
              Redirigiendo automáticamente a tu terminal de punto de venta...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Código de Activación (6 dígitos) *
              </label>
              <input
                type="text"
                maxLength={6}
                required
                value={activationCode}
                onChange={(e) => setActivationCode(e.target.value)}
                placeholder="123456"
                className="w-full text-center tracking-[0.4em] font-mono text-xl py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-sky-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Crear tu Contraseña Personal *
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Confirmar Contraseña *
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite la contraseña"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-sky-700 hover:bg-sky-800 disabled:opacity-50 text-white font-bold rounded-xl text-sm flex items-center justify-center space-x-2 transition"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Activando credenciales...</span>
                </>
              ) : (
                <>
                  <span>Activar y Entrar al Sistema</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        <div className="text-center text-xs text-slate-500 pt-2">
          <span>¿Ya tienes credenciales activas? </span>
          <Link href="/login" className="text-sky-700 font-semibold hover:underline">
            Iniciar Sesión
          </Link>
        </div>
      </div>
    </div>
  );
}

