'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Store,
  Wrench,
  Utensils,
  Shirt,
  Pill,
  ShoppingBag,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  calculateNitDv,
  COLOMBIA_DOCUMENT_TYPES,
  COLOMBIA_DEPARTMENTS,
  HABEAS_DATA_COLOMBIA_STATEMENT,
} from '@/lib/colombia-documents';

const FAST_CATEGORIES = [
  {
    id: 'TIENDA_BARRIO',
    name: 'Tienda de Barrio / Minimarket',
    desc: 'Ventas rápidas, balanza y fiado recurrente',
    icon: <Store className="w-5 h-5 text-sky-600" />,
  },
  {
    id: 'RESTAURANTE_COMIDAS',
    name: 'Restaurante / Cafetería / Bar',
    desc: 'Comandas, mesas, propinas y cocina',
    icon: <Utensils className="w-5 h-5 text-sky-600" />,
  },
  {
    id: 'FERRETERIA_MATERIALES',
    name: 'Ferretería / Materiales',
    desc: 'Precios mayoristas y múltiples bodegas',
    icon: <Wrench className="w-5 h-5 text-sky-600" />,
  },
  {
    id: 'DROGUERIA_FARMACIA',
    name: 'Droguería / Farmacia',
    desc: 'Control de lotes y fechas de vencimiento',
    icon: <Pill className="w-5 h-5 text-sky-600" />,
  },
  {
    id: 'ROPA_CALZADO',
    name: 'Ropa / Calzado / Moda',
    desc: 'Matriz de tallas, colores y devoluciones',
    icon: <Shirt className="w-5 h-5 text-sky-600" />,
  },
  {
    id: 'SERVICIOS_TECNICOS',
    name: 'Servicios Técnicos / Taller',
    desc: 'Órdenes de servicio y cotizaciones',
    icon: <ShoppingBag className="w-5 h-5 text-sky-600" />,
  },
];

function RegisterContent() {
  const router = useRouter();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Paso 1: Titular
  const [ownerFirstName, setOwnerFirstName] = useState('');
  const [ownerLastName, setOwnerLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('+57 ');
  const [documentType, setDocumentType] = useState('CC');
  const [documentNumber, setDocumentNumber] = useState('');

  // Paso 2: Empresa
  const [businessName, setBusinessName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [commercialCategory, setCommercialCategory] = useState('TIENDA_BARRIO');
  const [department, setDepartment] = useState('Bogotá D.C.');
  const [city, setCity] = useState('Bogotá D.C.');
  const [address, setAddress] = useState('');

  // Paso 3: Plan y Habeas Data
  const [planCode, setPlanCode] = useState('PRO_GROWTH');
  const [acceptedHabeasData, setAcceptedHabeasData] = useState(true);

  const calculatedDv =
    documentType === 'NIT' && documentNumber.trim()
      ? calculateNitDv(documentNumber.trim())
      : null;

  const handleNextStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!ownerFirstName.trim() || !ownerLastName.trim()) {
      setError('Por favor ingrese el nombre y apellido del titular.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Por favor ingrese un correo electrónico válido.');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (!documentNumber.trim()) {
      setError('Por favor ingrese el número de documento de identificación.');
      return;
    }
    setStep(2);
  };

  const handleNextStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!tradeName.trim()) {
      setError('Por favor ingrese el nombre comercial de su negocio.');
      return;
    }
    setStep(3);
  };

  const handleCompleteRegistration = async () => {
    if (!acceptedHabeasData) {
      setError('Debe aceptar el tratamiento de datos personales (Habeas Data Ley 1581) para continuar.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const payload = {
        ownerFirstName: ownerFirstName.trim(),
        ownerLastName: ownerLastName.trim(),
        email: email.trim().toLowerCase(),
        password,
        ownerPhone: ownerPhone.trim(),
        documentType,
        documentNumber: documentNumber.trim(),
        nitDv: calculatedDv || undefined,
        businessName: businessName.trim() || tradeName.trim(),
        tradeName: tradeName.trim(),
        commercialCategory,
        department,
        city,
        address: address.trim() || undefined,
        planCode,
        acceptedHabeasData: true,
      };

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || 'Error al procesar el registro del comercio.');
      }

      if (data.pending) {
        router.push('/register/pending');
      } else {
        router.push('/pos');
      }
    } catch (err: any) {
      setError(err.message || 'Error de comunicación al registrar la empresa.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 flex flex-col justify-between p-4 sm:p-8 text-slate-700">
      <header className="w-full max-w-4xl mx-auto flex justify-between items-center mb-8">
        <div className="flex items-center space-x-3">
          <span className="text-2xl font-black text-sky-700">UniSaaS</span>
          <span className="text-xs text-slate-500 font-medium border-l border-slate-300 pl-3">
            Plataforma POS & Contabilidad Colombia
          </span>
        </div>
        <div className="text-sm">
          <span>¿Ya tiene una cuenta? </span>
          <Link href="/login" className="text-sky-700 font-semibold hover:underline">
            Iniciar Sesión
          </Link>
        </div>
      </header>

      <main className="w-full max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-10 mb-8">
        {/* Stepper Header */}
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <span
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                step >= 1 ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'
              }`}
            >
              1
            </span>
            <span className="text-sm font-medium">Titular</span>
          </div>
          <div className="w-12 h-0.5 bg-slate-200" />
          <div className="flex items-center space-x-3">
            <span
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                step >= 2 ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'
              }`}
            >
              2
            </span>
            <span className="text-sm font-medium">Empresa</span>
          </div>
          <div className="w-12 h-0.5 bg-slate-200" />
          <div className="flex items-center space-x-3">
            <span
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                step >= 3 ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'
              }`}
            >
              3
            </span>
            <span className="text-sm font-medium">Plan & Activación</span>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: Titular */}
        {step === 1 && (
          <form onSubmit={handleNextStep1} className="space-y-5">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-slate-900">Datos del Titular / Propietario</h2>
              <p className="text-sm text-slate-500">
                Esta cuenta tendrá privilegios OWNER para administrar su negocio y caja.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nombres *</label>
                <input
                  type="text"
                  required
                  value={ownerFirstName}
                  onChange={(e) => setOwnerFirstName(e.target.value)}
                  placeholder="Ej. Carlos"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Apellidos *</label>
                <input
                  type="text"
                  required
                  value={ownerLastName}
                  onChange={(e) => setOwnerLastName(e.target.value)}
                  placeholder="Ej. Gómez"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo Doc. *</label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-sky-500 outline-none bg-white"
                >
                  {COLOMBIA_DOCUMENT_TYPES.map((dt) => (
                    <option key={dt.code} value={dt.code}>
                      {dt.code}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Número de Documento *
                  {calculatedDv !== null && (
                    <span className="ml-2 text-sky-600 font-bold">(DV: {calculatedDv})</span>
                  )}
                </label>
                <input
                  type="text"
                  required
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  placeholder="Ej. 1020304050"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Correo Electrónico *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="carlos@negocio.com"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Contraseña *</label>
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono Móvil</label>
                <input
                  type="text"
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                  placeholder="+57 310 1234567"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                className="px-6 py-2.5 bg-sky-700 hover:bg-sky-800 text-white font-semibold rounded-xl text-sm flex items-center space-x-2 transition"
              >
                <span>Continuar a Empresa</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Empresa */}
        {step === 2 && (
          <form onSubmit={handleNextStep2} className="space-y-5">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-slate-900">Datos de la Empresa y Rubro</h2>
              <p className="text-sm text-slate-500">
                Configura tu negocio para adaptar el punto de venta a tu rubro comercial.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nombre Comercial del Establecimiento *
              </label>
              <input
                type="text"
                required
                value={tradeName}
                onChange={(e) => setTradeName(e.target.value)}
                placeholder="Ej. Supermercado El Ahorro"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Selecciona tu Rubro Comercial Principal *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {FAST_CATEGORIES.map((cat) => (
                  <div
                    key={cat.id}
                    onClick={() => setCommercialCategory(cat.id)}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition flex items-start space-x-3 ${
                      commercialCategory === cat.id
                        ? 'border-sky-600 bg-sky-50/50 ring-2 ring-sky-500'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="mt-0.5">{cat.icon}</div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{cat.name}</h4>
                      <p className="text-[11px] text-slate-500">{cat.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Departamento</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-sky-500 outline-none bg-white"
                >
                  {COLOMBIA_DEPARTMENTS.map((dept) => (
                    <option key={dept.name} value={dept.name}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Ciudad / Municipio</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ej. Bogotá D.C."
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Dirección de la Sede</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ej. Carrera 15 # 45-20"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-sky-500 outline-none"
              />
            </div>

            <div className="pt-4 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 flex items-center space-x-1"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Atrás</span>
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-sky-700 hover:bg-sky-800 text-white font-semibold rounded-xl text-sm flex items-center space-x-2 transition"
              >
                <span>Continuar a Planes</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Planes y Aceptación */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-slate-900">Plan SaaS y Términos Legales</h2>
              <p className="text-sm text-slate-500">
                Comience con el plan que mejor se adapte a sus necesidades. Puede cambiar de plan en cualquier momento.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div
                onClick={() => setPlanCode('PRO_GROWTH')}
                className={`p-4 rounded-xl border cursor-pointer transition text-center ${
                  planCode === 'PRO_GROWTH'
                    ? 'border-sky-600 bg-sky-50/50 ring-2 ring-sky-500'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <span className="text-[10px] font-bold tracking-wider text-sky-700 uppercase bg-sky-100 px-2 py-0.5 rounded-full">
                  Recomendado
                </span>
                <h4 className="text-sm font-bold text-slate-900 mt-2">Crecimiento Pro</h4>
                <p className="text-lg font-black text-slate-900 mt-1">$ 79.900 <span className="text-xs font-normal text-slate-500">/mes</span></p>
                <p className="text-[11px] text-slate-500 mt-2">3 sedes, 10 colaboradores, 15.000 facturas/mes</p>
              </div>

              <div
                onClick={() => setPlanCode('STARTER_EMPRENDEDOR')}
                className={`p-4 rounded-xl border cursor-pointer transition text-center ${
                  planCode === 'STARTER_EMPRENDEDOR'
                    ? 'border-sky-600 bg-sky-50/50 ring-2 ring-sky-500'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <h4 className="text-sm font-bold text-slate-900 mt-2">Emprendedor</h4>
                <p className="text-lg font-black text-slate-900 mt-1">$ 39.900 <span className="text-xs font-normal text-slate-500">/mes</span></p>
                <p className="text-[11px] text-slate-500 mt-2">1 sede, 2 colaboradores, 3.000 facturas/mes</p>
              </div>

              <div
                onClick={() => setPlanCode('PILOTO_FREE')}
                className={`p-4 rounded-xl border cursor-pointer transition text-center ${
                  planCode === 'PILOTO_FREE'
                    ? 'border-sky-600 bg-sky-50/50 ring-2 ring-sky-500'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <h4 className="text-sm font-bold text-slate-900 mt-2">Prueba Piloto</h4>
                <p className="text-lg font-black text-emerald-600 mt-1">Gratis</p>
                <p className="text-[11px] text-slate-500 mt-2">1 sede, 1 caja, modo de prueba inicial</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-3">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptedHabeasData}
                  onChange={(e) => setAcceptedHabeasData(e.target.checked)}
                  className="mt-0.5 rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
                />
                <span>
                  <strong>Autorización Habeas Data:</strong> {HABEAS_DATA_COLOMBIA_STATEMENT}
                </span>
              </label>
            </div>

            <div className="pt-4 flex justify-between items-center">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 flex items-center space-x-1"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Atrás</span>
              </button>

              <button
                type="button"
                disabled={isLoading}
                onClick={handleCompleteRegistration}
                className="px-8 py-3 bg-sky-700 hover:bg-sky-800 disabled:opacity-50 text-white font-bold rounded-xl text-sm flex items-center space-x-2 transition shadow-md"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Aprovisionando Negocio...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Completar Registro y Abrir Caja</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-slate-400">
        UniSaaS Colombia © 2026 — Monorepo Monolítico Seguro con RLS en PostgreSQL
      </footer>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Cargando registro...</div>}>
      <RegisterContent />
    </Suspense>
  );
}

