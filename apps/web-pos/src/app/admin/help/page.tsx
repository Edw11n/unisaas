'use client';

import React from 'react';

export default function AdminHelpPage() {
  const hotkeys = [
    { key: 'F1', action: 'Manual de Usuario y Atajos', description: 'Abre este panel de documentacion y atajos' },
    { key: 'F2', action: 'Cobrar Venta en POS', description: 'Abre el modal de pago multimoneda en el mostrador' },
    { key: 'F3', action: 'Buscar / Asignar Cliente', description: 'Asigna cliente para facturacion o venta a fiado' },
    { key: 'F4', action: 'Buscar Articulo en Catalogo', description: 'Busqueda rapida por SKU, nombre o categoria' },
    { key: 'F7', action: 'Modificar Cantidad', description: 'Cambia las unidades del producto activo en carrito' },
    { key: 'F8', action: 'Apertura de Gaveta', description: 'Envia pulso electrico ESC/POS al cajon monedero' },
    { key: 'F9', action: 'Descuento Autorizado', description: 'Aplica porcentaje o monto de rebaja con supervisor' },
    { key: 'F10', action: 'Turno y Arqueo de Caja', description: 'Visualiza el arqueo esperado y conteo fisico' },
    { key: 'ESC', action: 'Cancelar / Limpiar Carrito', description: 'Cierra cualquier modal o limpia la orden activa' },
  ];

  const faqs = [
    {
      q: 'Como registrar una venta a credito (fiado) de manera segura?',
      a: 'En la pantalla del POS (/pos), presione F3 para asignar el cliente. El sistema verificara en Squad 7 su cupo disponible. Al presionar F2 (Cobrar), seleccione el medio "Credito (Fiado)". La deuda se asienta con bloqueo transaccional.',
    },
    {
      q: 'Que hacer ante una inconsistencia o descuadre en el arqueo de caja?',
      a: 'En la pestana "Ventas y Caja", seleccione "Turno y Arqueo de Caja". Ingrese el efectivo contado y detalle obligatoriamente en el campo de texto el motivo del sobrante o faltante. Esto registrara el asiento contable de ajuste en Squad 2.',
    },
    {
      q: 'Como opera la app movil de Flutter sin conexion a internet?',
      a: 'La aplicacion movil nativa almacena catalogo, clientes y ventas en una base de datos local SQLite/Drift. Cuando se restablece la senal de internet, el servicio en segundo plano (SyncQueueWorker) sube automaticamente los comprobantes al servidor.',
    },
    {
      q: 'Como configurar la impresion termica de tickets para 80mm o 58mm?',
      a: 'Dirijase a "Equipo y Ajustes", pestana "Impresion Termica ESC/POS". Seleccione el ancho de su rollo y tipo de conexion (USB directo o red Ethernet). Puede personalizar el encabezado y pie de pagina con el NIT y razon social.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
          Centro de Ayuda, Atajos y Soporte Tecnico
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Guia de operacion del sistema, atajos rapidos de teclado para el mostrador y contacto de asistencia
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Columna Izquierda: Atajos de Teclado Mostrador POS */}
        <div className="lg:col-span-7 bg-white p-6 rounded-3xl shadow-xs border border-slate-100 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-extrabold text-slate-900">
              Atajos de Teclado para Venta Rapida (Mostrador POS)
            </h2>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {hotkeys.map((h) => (
              <div key={h.key} className="py-2.5 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="w-12 py-1 text-center font-mono font-extrabold bg-slate-900 text-white rounded-lg shadow-xs text-xs">
                    {h.key}
                  </span>
                  <div>
                    <div className="font-bold text-slate-900">{h.action}</div>
                    <div className="text-[11px] text-slate-400">{h.description}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Columna Derecha: Canales de Soporte */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-gradient-to-br from-[#135273] to-[#18668F] rounded-3xl p-6 text-white shadow-sm space-y-3">
            <h3 className="text-base font-extrabold">Soporte Tecnico Directo UNISAAS</h3>
            <p className="text-xs text-white/80 leading-relaxed">
              Equipo de guardia 24/7 para incidencias de hardware, impresoras termicas, base de datos o conexion en Putumayo y Colombia.
            </p>
            <div className="pt-2 text-xs space-y-1.5 font-mono">
              <div>WhatsApp: +57 (311) 489-1234</div>
              <div>Nivel de Servicio: SLA 99.9% Uptime</div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-xs border border-slate-100 space-y-3">
            <h3 className="text-sm font-extrabold text-slate-900">Seguridad y Privacidad Empresarial</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              UNISAAS opera bajo aislamiento estricto de cuentas y almacenamiento con cifrado de nivel bancario. Toda la informacion de su negocio, ventas, clientes y finanzas permanece completamente privada e inaccesible para terceros.
            </p>
          </div>
        </div>
      </div>

      {/* Preguntas Frecuentes */}
      <div className="bg-white rounded-3xl shadow-xs border border-slate-100 p-6 space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-sm font-extrabold text-slate-900">
            Preguntas Frecuentes y Procedimientos Operativos
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {faqs.map((f, idx) => (
            <div key={idx} className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 space-y-1.5">
              <h3 className="font-extrabold text-slate-900">{f.q}</h3>
              <p className="text-slate-600 leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
