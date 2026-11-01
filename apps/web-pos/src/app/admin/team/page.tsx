'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  CheckCircle2,
  X,
  AlertCircle,
  ChevronRight,
  Trash2,
  Users,
  Shield,
  KeyRound,
} from 'lucide-react';
import { EntityMonogram } from '@/components/ui/entity-monogram';

const ROLE_LABELS_ES: Record<string, string> = {
  OWNER: 'Propietario',
  ADMIN: 'Administrador',
  CASHIER: 'Cajero',
  WAREHOUSE_MANAGER: 'Jefe de Bodega',
  ACCOUNTANT: 'Contador',
};

const CANONICAL_ROLES = [
  { code: 'ADMIN', label: 'Administrador', description: 'Gestión de operaciones, equipo y caja' },
  { code: 'CASHIER', label: 'Cajero', description: 'Operación POS, ventas y turnos de caja' },
  { code: 'WAREHOUSE_MANAGER', label: 'Jefe de Bodega', description: 'Kardex, stock y compras' },
  { code: 'ACCOUNTANT', label: 'Contador', description: 'Libro contable, reportes y PUC' },
] as const;

type CanonicalRoleCode = 'OWNER' | 'ADMIN' | 'CASHIER' | 'WAREHOUSE_MANAGER' | 'ACCOUNTANT';

interface Collaborator {
  id: string;
  email: string;
  fullName: string;
  role: CanonicalRoleCode | string;
  status: string;
  createdAt: string;
  branchName?: string | null;
}

interface TeamQuota {
  used: number;
  limit: number;
  planName: string;
}

export default function AdminTeamPage() {
  const [activeTab, setActiveTab] = useState<'colaboradores' | 'roles'>('colaboradores');
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [quota, setQuota] = useState<TeamQuota>({ used: 0, limit: 5, planName: 'Plan Basico' });
  const [isLoading, setIsLoading] = useState(true);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [currentSessionUser, setCurrentSessionUser] = useState<{
    id?: string;
    fullName?: string;
    email?: string;
    role?: string;
    tenantId?: string;
  } | null>(null);

  // Modal para registrar colaborador
  const [showNewMemberModal, setShowNewMemberModal] = useState(false);
  const [fullName, setFullName] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [modalErrorMessage, setModalErrorMessage] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<CanonicalRoleCode>('CASHIER');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal para eliminar colaborador
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<Collaborator | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadTeamData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/team', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error('No fue posible consultar los colaboradores.');
      }
      const data = await res.json();
      setCollaborators(Array.isArray(data.collaborators) ? data.collaborators : []);
      if (data.quota) {
        setQuota({
          used: Number(data.quota.used ?? 0),
          limit: Number(data.quota.limit ?? 5),
          planName: String(data.quota.planName ?? 'Plan Basico'),
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar equipo.';
      setFeedbackMessage({ type: 'error', text: msg });
      setCollaborators([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('unisaas_active_session');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed?.user) setCurrentSessionUser(parsed.user);
        }
      } catch {}
    }

    loadTeamData();
  }, [loadTeamData]);

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMessage(null);

    if (!fullName.trim() || fullName.trim().length < 3) {
      setFeedbackMessage({ type: 'error', text: 'El nombre completo debe tener al menos 3 caracteres.' });
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setFeedbackMessage({ type: 'error', text: 'Ingrese un correo electrónico válido.' });
      return;
    }

    if (!temporaryPassword.trim() || temporaryPassword.trim().length < 8) {
      setFeedbackMessage({ type: 'error', text: 'La contraseña temporal debe tener al menos 8 caracteres.' });
      return;
    }

    if (!documentNumber.trim() || documentNumber.trim().length < 4) {
      setModalErrorMessage('Ingrese un número de documento válido (mínimo 4 caracteres).');
      return;
    }

    setModalErrorMessage(null);
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          documentNumber: documentNumber.trim(),
          email: email.trim().toLowerCase(),
          role,
          temporaryPassword: temporaryPassword.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'No fue posible registrar el colaborador.');
      }

      setFeedbackMessage({
        type: 'success',
        text: `Colaborador ${fullName.trim()} registrado exitosamente como ${ROLE_LABELS_ES[role] || role}.`,
      });

      setShowNewMemberModal(false);
      setFullName('');
      setDocumentNumber('');
      setEmail('');
      setRole('CASHIER');
      setTemporaryPassword('');
      setModalErrorMessage(null);
      await loadTeamData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado al registrar colaborador.';
      setModalErrorMessage(msg);
      setFeedbackMessage({ type: 'error', text: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDeleteModal = (collab: Collaborator) => {
    if (
      collab.id === currentSessionUser?.id ||
      (currentSessionUser?.email && collab.email.toLowerCase() === currentSessionUser.email.toLowerCase())
    ) {
      setFeedbackMessage({
        type: 'error',
        text: 'No es posible eliminar la cuenta de sesión activa actual.',
      });
      return;
    }
    setMemberToDelete(collab);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!memberToDelete) return;
    setIsDeleting(true);
    setFeedbackMessage(null);
    try {
      const res = await fetch(`/api/admin/team?id=${encodeURIComponent(memberToDelete.id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: memberToDelete.id }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'No se pudo eliminar el colaborador.');
      }

      setFeedbackMessage({
        type: 'success',
        text: `Colaborador ${memberToDelete.fullName} deshabilitado correctamente.`,
      });
      setShowDeleteModal(false);
      setMemberToDelete(null);
      await loadTeamData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar el colaborador.';
      setFeedbackMessage({ type: 'error', text: msg });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleGeneratePassword = () => {
    const chars = 'abcdefghijkmnpqrstuvwxyz23456789ABCDEFGHJKLMNPQRSTUVWXYZ!@#$';
    let pwd = '';
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setTemporaryPassword(pwd);
  };

  const getRoleLabel = (code: string) => {
    const found = CANONICAL_ROLES.find((r) => r.code === code);
    return found ? found.label : code;
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 px-2 sm:px-4 lg:px-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Personal, Colaboradores y Roles Canónicos
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Administración centralizada de usuarios bajo los 5 roles canónicos del sistema
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Link
            href="/pos"
            className="px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center space-x-1.5 shadow-xs transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Volver a POS</span>
          </Link>
          <Link
            href="/admin/inventory"
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-colors"
          >
            <span>Carga Masiva Inventario</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {feedbackMessage && (
        <div
          className={`p-3.5 rounded-2xl flex items-center justify-between border text-xs ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{feedbackMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            className="text-slate-400 hover:text-slate-700 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tarjetas de Resumen y Cuota Real */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Colaboradores Activos</span>
          <p className="text-xl font-extrabold text-slate-900 mt-1">{collaborators.length}</p>
          <span className="text-[10px] text-slate-500 font-medium">Registrados en base de datos</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Cuota de Usuarios</span>
          <p className="text-xl font-extrabold text-indigo-600 mt-1">
            {quota.used} / {quota.limit}
          </p>
          <span className="text-[10px] text-slate-500 font-medium">{quota.planName}</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase">Roles Canónicos</span>
          <p className="text-xl font-extrabold text-slate-900 mt-1">{CANONICAL_ROLES.length}</p>
          <span className="text-[10px] text-slate-500 font-medium">OWNER, ADMIN, CASHIER, WAREHOUSE, ACCOUNTANT</span>
        </div>
      </div>

      <div className="flex items-center space-x-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('colaboradores')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition-colors ${
            activeTab === 'colaboradores'
              ? 'border-[#0066FF] text-[#0066FF]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Colaboradores ({collaborators.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('roles')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition-colors ${
            activeTab === 'roles'
              ? 'border-[#0066FF] text-[#0066FF]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Roles del Sistema ({CANONICAL_ROLES.length})</span>
        </button>
      </div>

      {activeTab === 'colaboradores' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">Personal del Comercio</h2>
              <p className="text-xs text-slate-500">
                Usuarios con credenciales de acceso para terminal POS o panel de administración
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowNewMemberModal(true)}
              className="px-4 py-2 bg-[#0066FF] hover:bg-[#0052CC] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Colaborador</span>
            </button>
          </div>

          {/* Vista Móvil (< 1024px) */}
          <div className="block lg:hidden space-y-3">
            {isLoading ? (
              <div className="p-8 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-[#0066FF] animate-pulse" />
                  <span className="text-xs font-semibold">Cargando equipo de colaboradores...</span>
                </div>
              </div>
            ) : collaborators.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs font-medium bg-white rounded-2xl border border-slate-200">
                No hay colaboradores registrados. Cree uno con el botón Nuevo Colaborador.
              </div>
            ) : (
              collaborators.map((member) => (
                <div key={member.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-3">
                      <EntityMonogram
                        name={member.fullName}
                        size="lg"
                        shape="circle"
                        className="shadow-2xs"
                      />
                      <div>
                        <p className="font-bold text-slate-900 text-sm leading-tight">{member.fullName}</p>
                        <p className="text-[11px] font-mono font-medium text-slate-600 mt-0.5">
                          {member.email}
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold border bg-slate-50 text-slate-700 border-slate-200 shrink-0">
                      {ROLE_LABELS_ES[member.role] || member.role}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 py-2 px-3 bg-slate-50 rounded-xl text-[11px] border border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[10px] font-bold uppercase">Sucursal</span>
                      <span className="font-semibold text-slate-800">{member.branchName || 'Principal'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] font-bold uppercase">Estado</span>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          member.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {member.status === 'ACTIVE' ? 'Activo' : member.status}
                      </span>
                    </div>
                  </div>

                  {!(
                    member.id === currentSessionUser?.id ||
                    (currentSessionUser?.email && member.email.toLowerCase() === currentSessionUser.email.toLowerCase())
                  ) && (
                    <div className="flex justify-end pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleOpenDeleteModal(member)}
                        className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 transition-colors flex items-center space-x-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Deshabilitar</span>
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Vista Escritorio (>= 1024px) */}
          <div className="hidden lg:block bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase">
                    <th className="py-3 px-4">Colaborador</th>
                    <th className="py-3 px-4">Correo</th>
                    <th className="py-3 px-4">Rol Asignado</th>
                    <th className="py-3 px-4">Sucursal</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        <div className="flex items-center justify-center space-x-2">
                          <div className="w-2 h-2 rounded-full bg-[#0066FF] animate-pulse" />
                          <span className="text-xs font-semibold">Cargando equipo de colaboradores...</span>
                        </div>
                      </td>
                    </tr>
                  ) : collaborators.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 text-xs font-medium">
                        No hay colaboradores registrados. Cree uno con el botón Nuevo Colaborador.
                      </td>
                    </tr>
                  ) : (
                    collaborators.map((member) => (
                      <tr key={member.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-3">
                            <EntityMonogram
                              name={member.fullName}
                              size="md"
                              shape="circle"
                              className="shadow-2xs"
                            />
                            <div>
                              <p className="font-bold text-slate-900 leading-tight">{member.fullName}</p>
                              <span className="text-[10px] text-slate-400 font-mono">
                                ID: {member.id.substring(0, 8)}...
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">{member.email}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold border bg-slate-50 text-slate-700 border-slate-200">
                            {ROLE_LABELS_ES[member.role] || member.role}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                          {member.branchName || 'Principal'}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              member.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {member.status === 'ACTIVE' ? 'Activo' : member.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {!(
                            member.id === currentSessionUser?.id ||
                            (currentSessionUser?.email && member.email.toLowerCase() === currentSessionUser.email.toLowerCase())
                          ) && (
                            <button
                              type="button"
                              onClick={() => handleOpenDeleteModal(member)}
                              className="text-[11px] font-bold px-2 py-1 rounded-lg border bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 transition-colors inline-flex items-center space-x-1"
                              title={`Deshabilitar colaborador ${member.fullName}`}
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Deshabilitar</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'roles' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <h2 className="text-sm font-extrabold text-slate-900">Catálogo de Roles Canónicos</h2>
            <p className="text-xs text-slate-500">
              UNISAAS opera bajo una matriz estricta de 5 roles de sistema protegidos con Row Level Security
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CANONICAL_ROLES.map((r) => (
              <div key={r.code} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold border bg-indigo-50 border-indigo-200 text-indigo-700">
                    {r.code}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Canónico
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900">{r.label}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{r.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Registrar Nuevo Colaborador */}
      {showNewMemberModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Registrar Nuevo Colaborador</h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  Complete los datos obligatorios para habilitar el usuario en la empresa
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewMemberModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMember} className="mt-4 space-y-3.5 text-xs">
              {modalErrorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center space-x-2 text-xs font-semibold animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{modalErrorMessage}</span>
                </div>
              )}
              <div>
                <label className="block text-slate-700 font-bold mb-1">Nombre Completo:</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Sofia Rodriguez"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 rounded-xl text-slate-900 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0066FF]"
                />
              </div>

                            <div>
                <label className="block text-slate-700 font-bold mb-1">Cédula / Documento de Identidad:</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. 1098765432"
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 rounded-xl text-slate-900 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0066FF]"
                />
              </div>
<div>
                <label className="block text-slate-700 font-bold mb-1">Correo Electrónico:</label>
                <input
                  type="email"
                  required
                  placeholder="ej. sofia@comercio.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 rounded-xl text-slate-900 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0066FF]"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Rol Canónico Asignado:</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as CanonicalRoleCode)}
                  className="w-full p-2.5 bg-slate-50 rounded-xl text-slate-900 font-bold border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0066FF]"
                >
                  {CANONICAL_ROLES.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  El rol Propietario es único y no puede crearse desde este formulario.
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-700 font-bold">Contraseña Temporal:</label>
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="text-[11px] font-bold text-[#0066FF] hover:underline"
                  >
                    Generar segura
                  </button>
                </div>
                <input
                  type="text"
                  required
                  placeholder="Mínimo 8 caracteres"
                  value={temporaryPassword}
                  onChange={(e) => setTemporaryPassword(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 rounded-xl text-slate-900 font-mono border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0066FF]"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs rounded-xl transition-colors shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Guardando...' : 'Registrar Colaborador'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewMemberModal(false)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminación */}
      {showDeleteModal && memberToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">Deshabilitar Colaborador</h3>
                <p className="text-[11px] text-slate-500 font-medium">Esta acción revoca el acceso del usuario</p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl space-y-1 text-xs">
              <p className="font-bold text-rose-950">
                ¿Desea deshabilitar a {memberToDelete.fullName}?
              </p>
              <p className="text-[11px] text-rose-800 font-mono">{memberToDelete.email}</p>
              <p className="text-[11px] text-rose-700 pt-1 leading-relaxed">
                El usuario pasará a estado inactivo y no podrá iniciar sesión en la plataforma ni en los módulos POS.
              </p>
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-colors shadow-xs"
              >
                {isDeleting ? 'Deshabilitando...' : 'Confirmar y Deshabilitar'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setMemberToDelete(null);
                }}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
