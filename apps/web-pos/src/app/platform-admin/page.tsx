'use client';

import React, { useCallback, useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Plus,
  X,
  Search,
  Loader2,
  Trash2,
  KeyRound,
  RefreshCw,
  Copy,
  Sliders,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { formatCOP } from '@/lib/currency';

type PlanCode = 'FREE' | 'BASICO' | 'PYME_PRO' | 'RESTAURANTE_PRO' | 'ENTERPRISE';

export interface PlatformPlanItem {
  code: string;
  name: string;
  priceCOP: number;
  billingCycle: string;
  tagline: string | null;
  badge: string | null;
  colorAccent: string;
  maxPosTerminals: number;
  maxBranches: number;
  maxInvoicesPerMonth: number;
  features: string[];
  isActive: boolean;
  displayOrder: number;
  updatedAt: string;
}


interface PendingTenantItem {
  id: string;
  businessName: string;
  tradeName: string;
  nit: string;
  city: string;
  address: string;
  businessPhone: string;
  plan: string;
  commercialCategory: string;
  registrationStatus: string;
  createdAt: string;
  ownerId: string;
  ownerEmail: string;
  ownerFullName: string;
  ownerPhone: string;
  avatarUrl: string | null;
  authProvider: string;
}

interface TenantItem {
  id: string;
  name: string;
  tradeName: string;
  nit: string;
  email: string;
  city: string;
  plan: PlanCode;
  category: string;
  branches: number;
  users: number;
  products: number;
  invoices: number;
  status: 'ACTIVO' | 'SUSPENDIDO';
  createdAt: string;
}

interface AuditItem {
  id: string;
  timestamp: string;
  actor: string;
  event: string;
  details: string;
  ip: string;
}

interface CredentialReveal {
  title: string;
  email: string;
  password: string;
  note?: string;
}

const PLAN_FEES: Record<PlanCode, number> = {
  FREE: 0,
  BASICO: 45000,
  PYME_PRO: 89000,
  RESTAURANTE_PRO: 160000,
  ENTERPRISE: 320000,
};

const PLAN_LABELS: Record<PlanCode, string> = {
  FREE: 'Plan Piloto Comunitario ($ 0/mes - Gratis)',
  BASICO: 'Plan Basico ($ 45.000/mes)',
  PYME_PRO: 'Plan Pyme Pro ($ 89.000/mes)',
  RESTAURANTE_PRO: 'Plan Restaurante Pro ($ 160.000/mes)',
  ENTERPRISE: 'Plan Enterprise ($ 320.000/mes)',
};

const CATEGORY_OPTIONS = [
  { code: 'TIENDA_BARRIO', label: 'Tienda de barrio' },
  { code: 'MINIMERCADO', label: 'Minimercado / supermercado' },
  { code: 'FERRETERIA', label: 'Ferreteria' },
  { code: 'RESTAURANTE', label: 'Restaurante' },
  { code: 'COMIDAS_RAPIDAS', label: 'Comidas rapidas' },
  { code: 'PANADERIA_PASTELERIA', label: 'Panaderia / pasteleria' },
  { code: 'DROGUERIA_FARMACIA', label: 'Drogueria / farmacia' },
  { code: 'ROPA_CALZADO', label: 'Ropa y calzado' },
  { code: 'TECNOLOGIA_CELULARES', label: 'Tecnologia / celulares' },
  { code: 'PAPELERIA_MISCELANEA', label: 'Papeleria / miscelanea' },
  { code: 'DISTRIBUIDORA_MAYORISTA', label: 'Distribuidora mayorista' },
  { code: 'SERVICIOS', label: 'Servicios' },
  { code: 'OTRO', label: 'Otro' },
];

function normalizePlan(plan: unknown): PlanCode {
  const value = String(plan ?? '').trim().toUpperCase();
  return (['FREE', 'BASICO', 'PYME_PRO', 'RESTAURANTE_PRO', 'ENTERPRISE'] as const).includes(
    value as PlanCode,
  )
    ? (value as PlanCode)
    : 'BASICO';
}

function mapTenant(raw: any): TenantItem {
  const isActive =
    raw?.isActive !== undefined ? Boolean(raw.isActive) : raw?.status !== 'SUSPENDIDO';
  const counts = raw?.counts || {};
  return {
    id: String(raw?.id ?? ''),
    name: String(raw?.businessName ?? raw?.name ?? ''),
    tradeName: String(raw?.tradeName ?? ''),
    nit: String(raw?.nitRut ?? raw?.nit ?? ''),
    email: String(raw?.email ?? ''),
    city: String(raw?.city ?? ''),
    plan: normalizePlan(raw?.plan),
    category: String(raw?.category ?? 'TIENDA_BARRIO'),
    branches: Number(counts.branches ?? 0),
    users: Number(counts.users ?? 0),
    products: Number(counts.products ?? 0),
    invoices: Number(counts.invoices ?? 0),
    status: isActive ? 'ACTIVO' : 'SUSPENDIDO',
    createdAt: String(raw?.createdAt ?? ''),
  };
}

function formatDate(value: string): string {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function PlatformAdminContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get('tab') as
    | 'tenants'
    | 'planes'
    | 'squads'
    | 'auditoria'
    | 'pendientes'
    | null;
  const activeTab: 'tenants' | 'planes' | 'squads' | 'auditoria' | 'pendientes' =
    tabParam && ['tenants', 'planes', 'squads', 'auditoria', 'pendientes'].includes(tabParam)
      ? tabParam
      : 'tenants';

  const handleTabChange = (tab: 'tenants' | 'planes' | 'squads' | 'auditoria' | 'pendientes') => {
    if (tab === 'tenants') {
      router.push('/platform-admin');
    } else {
      router.push(`/platform-admin?tab=${tab}`);
    }
  };

  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');

  useEffect(() => {
    const handleCustomSearch = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      setSearchQuery(customEvent.detail ?? '');
    };
    window.addEventListener('platform-admin-search', handleCustomSearch);
    return () => window.removeEventListener('platform-admin-search', handleCustomSearch);
  }, []);

  useEffect(() => {
    const q = searchParams.get('q') || '';
    if (q !== searchQuery) {
      setSearchQuery(q);
    }
  }, [searchParams]);

  const handlePageSearchChange = (val: string) => {
    setSearchQuery(val);
    window.dispatchEvent(new CustomEvent('platform-admin-search-sync', { detail: val }));
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
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Alta de empresa
  const [showNewTenantModal, setShowNewTenantModal] = useState(false);
  const [newTenantName, setNewTenantName] = useState('');
  const [newTenantTradeName, setNewTenantTradeName] = useState('');
  const [newTenantNit, setNewTenantNit] = useState('');
  const [newTenantPlan, setNewTenantPlan] = useState<PlanCode>('BASICO');
  const [newTenantCategory, setNewTenantCategory] = useState('TIENDA_BARRIO');
  const [newTenantAddress, setNewTenantAddress] = useState('');
  const [newTenantCity, setNewTenantCity] = useState('');
  const [newTenantOwnerName, setNewTenantOwnerName] = useState('');
  const [newTenantOwnerEmail, setNewTenantOwnerEmail] = useState('');
  const [newTenantOwnerPhone, setNewTenantOwnerPhone] = useState('');
  const [createTenantError, setCreateTenantError] = useState<string | null>(null);
  const [isCreatingTenant, setIsCreatingTenant] = useState(false);

  // Edicion
  const [showEditTenantModal, setShowEditTenantModal] = useState(false);
  const [selectedTenantForEdit, setSelectedTenantForEdit] = useState<TenantItem | null>(null);
  const [editTenantName, setEditTenantName] = useState('');
  const [editTenantNit, setEditTenantNit] = useState('');
  const [editTenantPlan, setEditTenantPlan] = useState<PlanCode>('BASICO');
  const [editTenantActive, setEditTenantActive] = useState(true);
  const [editTenantError, setEditTenantError] = useState<string | null>(null);
  const [isSavingTenant, setIsSavingTenant] = useState(false);

  // Eliminacion
  const [tenantToDelete, setTenantToDelete] = useState<TenantItem | null>(null);
  const [deleteMode, setDeleteMode] = useState<'soft' | 'hard'>('soft');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Reset de contrasena / credenciales temporales
  const [isResetting, setIsResetting] = useState<string | null>(null);
  const [credentialReveal, setCredentialReveal] = useState<CredentialReveal | null>(null);
  // Solicitudes pendientes de aprobacion (Gobernanza Anti-bot)
  const [pendingTenants, setPendingTenants] = useState<PendingTenantItem[]>([]);
  const [isProcessingPending, setIsProcessingPending] = useState<string | null>(null);
  const [pendingActionMsg, setPendingActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);


  // Planes y Tarifas Dinamicas
  const [plans, setPlans] = useState<PlatformPlanItem[]>([]);
  const [editingPlanCode, setEditingPlanCode] = useState<string | null>(null);
  const [editPriceCOP, setEditPriceCOP] = useState<number>(0);
  const [editPlanName, setEditPlanName] = useState<string>('');
  const [editPlanTagline, setEditPlanTagline] = useState<string>('');
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [planSaveSuccess, setPlanSaveSuccess] = useState<string | null>(null);
  const [planSaveError, setPlanSaveError] = useState<string | null>(null);

  const handleUnauthorized = useCallback(
    (status: number): boolean => {
      if (status === 401) {
        router.replace('/login');
        return true;
      }
      return false;
    },
    [router],
  );

  const loadData = useCallback(async () => {
    setLoadError(null);
    try {
      const [tenantsRes, auditRes, plansRes, pendingRes] = await Promise.all([
        fetch('/api/platform/tenants', { cache: 'no-store' }),
        fetch('/api/platform/audit', { cache: 'no-store' }),
        fetch('/api/platform/plans', { cache: 'no-store' }),
        fetch('/api/platform/tenants/pending', { cache: 'no-store' }),
      ]);

      if (
        handleUnauthorized(tenantsRes.status) ||
        handleUnauthorized(auditRes.status) ||
        handleUnauthorized(plansRes.status)
      ) {
        return;
      }

      if (!tenantsRes.ok) {
        const err = await tenantsRes.json().catch(() => ({}));
        throw new Error(err?.message || 'No se pudieron cargar las empresas.');
      }
      if (!auditRes.ok) {
        const err = await auditRes.json().catch(() => ({}));
        throw new Error(err?.message || 'No se pudo cargar la auditoria global.');
      }

      const tenantsData = await tenantsRes.json();
      const auditData = await auditRes.json();

      setTenants(
        Array.isArray(tenantsData?.tenants) ? tenantsData.tenants.map(mapTenant) : [],
      );
      
      if (pendingRes && pendingRes.ok) {
        const pendingData = await pendingRes.json().catch(() => ({}));
        if (Array.isArray(pendingData?.pending)) {
          setPendingTenants(
            pendingData.pending.map((p: any) => ({
              id: String(p.id ?? ''),
              businessName: String(p.businessName ?? ''),
              tradeName: String(p.tradeName ?? ''),
              nit: String(p.nit ?? ''),
              city: String(p.city ?? ''),
              address: String(p.address ?? ''),
              businessPhone: String(p.businessPhone ?? ''),
              plan: String(p.plan ?? 'BASICO'),
              commercialCategory: String(p.commercialCategory ?? 'TIENDA_BARRIO'),
              registrationStatus: String(p.registrationStatus ?? 'PENDING_APPROVAL'),
              createdAt: formatDate(String(p.createdAt ?? '')),
              ownerId: String(p.ownerId ?? ''),
              ownerEmail: String(p.ownerEmail ?? ''),
              ownerFullName: String(p.ownerFullName ?? ''),
              ownerPhone: String(p.ownerPhone ?? ''),
              avatarUrl: p.avatarUrl || null,
              authProvider: String(p.authProvider ?? 'EMAIL'),
            })),
          );
        }
      }

      setAuditEvents(
        Array.isArray(auditData?.audit)
          ? auditData.audit.map((row: any) => ({
              id: String(row.id ?? ''),
              timestamp: formatDate(String(row.createdAt ?? '')),
              actor: String(row.adminEmail ?? 'unknown'),
              event: String(row.action ?? 'UNKNOWN'),
              details:
                row.details && Object.keys(row.details).length > 0
                  ? JSON.stringify(row.details)
                  : '-',
              ip: String(row.ip ?? '-'),
            }))
          : [],
      );

      if (plansRes.ok) {
        const plansData = await plansRes.json().catch(() => ({}));
        if (Array.isArray(plansData?.plans)) {
          setPlans(plansData.plans);
        }
      }
    } catch (err: unknown) {
      setLoadError(
        err instanceof Error ? err.message : 'Error de conexion con el servicio de plataforma.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [handleUnauthorized]);

  const handleStartEditPlan = (p: PlatformPlanItem) => {
    setEditingPlanCode(p.code);
    setEditPriceCOP(p.priceCOP);
    setEditPlanName(p.name);
    setEditPlanTagline(p.tagline || '');
    setPlanSaveError(null);
    setPlanSaveSuccess(null);
  };

  const handleCancelEditPlan = () => {
    setEditingPlanCode(null);
    setPlanSaveError(null);
  };

  const handleSavePlan = async (code: string) => {
    setIsSavingPlan(true);
    setPlanSaveError(null);
    setPlanSaveSuccess(null);
    try {
      const res = await fetch(`/api/platform/plans/${encodeURIComponent(code)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceCOP: editPriceCOP,
          name: editPlanName.trim() || undefined,
          tagline: editPlanTagline.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || 'No se pudo actualizar la tarifa del plan.');
      }
      setPlanSaveSuccess(
        `Tarifa del plan '${code}' actualizada a ${
          editPriceCOP === 0 ? 'GRATIS ($0)' : `${formatCOP(editPriceCOP)} COP`
        }.`,
      );
      setEditingPlanCode(null);
      await loadData();
    } catch (err: any) {
      setPlanSaveError(err instanceof Error ? err.message : 'Error al guardar la tarifa.');
    } finally {
      setIsSavingPlan(false);
    }
  };

  const handleTogglePlanActive = async (p: PlatformPlanItem) => {
    try {
      const res = await fetch(`/api/platform/plans/${encodeURIComponent(p.code)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isActive: !p.isActive,
        }),
      });
      if (res.ok) {
        await loadData();
      }
    } catch {
      // Ignorar error de red puntual
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  
  const handleApproveTenant = async (tenantId: string) => {
    setIsProcessingPending(tenantId);
    setPendingActionMsg(null);
    try {
      const res = await fetch(`/api/platform/tenants/${encodeURIComponent(tenantId)}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'No se pudo aprobar el comercio.');
      }
      setPendingActionMsg({ type: 'success', text: data.message || 'Comercio aprobado y habilitado.' });
      await loadData();
    } catch (err: any) {
      setPendingActionMsg({ type: 'error', text: err.message || 'Error al aprobar comercio.' });
    } finally {
      setIsProcessingPending(null);
    }
  };

  const handleRejectTenant = async (tenantId: string, businessName: string) => {
    if (!window.confirm(`¿Confirmar rechazo y eliminacion del comercio "${businessName}"? Esta accion no se puede deshacer.`)) {
      return;
    }
    setIsProcessingPending(tenantId);
    setPendingActionMsg(null);
    try {
      const res = await fetch(`/api/platform/tenants/${encodeURIComponent(tenantId)}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'No se pudo rechazar el comercio.');
      }
      setPendingActionMsg({ type: 'success', text: data.message || 'Comercio rechazado y purgado.' });
      await loadData();
    } catch (err: any) {
      setPendingActionMsg({ type: 'error', text: err.message || 'Error al rechazar comercio.' });
    } finally {
      setIsProcessingPending(null);
    }
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTenantName.trim() || !newTenantOwnerEmail.trim() || !newTenantOwnerName.trim()) {
      setCreateTenantError('Razon social, correo y nombre del propietario son obligatorios.');
      return;
    }

    setIsCreatingTenant(true);
    setCreateTenantError(null);
    const createdOwnerEmail = newTenantOwnerEmail.trim();
    try {
      const res = await fetch('/api/platform/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: newTenantName.trim(),
          tradeName: newTenantTradeName.trim() || newTenantName.trim(),
          nitRut: newTenantNit.trim() || undefined,
          plan: newTenantPlan,
          category: newTenantCategory,
          address: newTenantAddress.trim() || undefined,
          city: newTenantCity.trim() || undefined,
          ownerFullName: newTenantOwnerName.trim(),
          ownerEmail: newTenantOwnerEmail.trim(),
          ownerPhone: newTenantOwnerPhone.trim() || undefined,
        }),
      });

      if (handleUnauthorized(res.status)) return;

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || `No se pudo provisionar la empresa (HTTP ${res.status}).`);
      }

      setShowNewTenantModal(false);
      setNewTenantName('');
      setNewTenantTradeName('');
      setNewTenantNit('');
      setNewTenantPlan('BASICO');
      setNewTenantCategory('TIENDA_BARRIO');
      setNewTenantAddress('');
      setNewTenantCity('');
      setNewTenantOwnerName('');
      setNewTenantOwnerEmail('');
      setNewTenantOwnerPhone('');

      if (data?.temporaryPassword) {
        setCredentialReveal({
          title: 'Empresa provisionada - credenciales del propietario',
          email: data?.owner?.email || createdOwnerEmail,
          password: data.temporaryPassword,
          note:
            'Esta contrasena temporal se muestra UNA sola vez. Entreguela al propietario por un canal seguro y pídale cambiarla al ingresar.',
        });
      }

      await loadData();
    } catch (err: unknown) {
      setCreateTenantError(
        err instanceof Error ? err.message : 'Error de conexion al provisionar la empresa.',
      );
    } finally {
      setIsCreatingTenant(false);
    }
  };

  const handleOpenEditModal = (t: TenantItem) => {
    setSelectedTenantForEdit(t);
    setEditTenantName(t.name);
    setEditTenantNit(t.nit);
    setEditTenantPlan(t.plan);
    setEditTenantActive(t.status === 'ACTIVO');
    setEditTenantError(null);
    setShowEditTenantModal(true);
  };

  const handleSaveEditTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenantForEdit) return;

    setIsSavingTenant(true);
    setEditTenantError(null);
    try {
      const res = await fetch(
        `/api/platform/tenants/${encodeURIComponent(selectedTenantForEdit.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            businessName: editTenantName.trim(),
            nitRut: editTenantNit.trim(),
            plan: editTenantPlan,
            isActive: editTenantActive,
          }),
        },
      );

      if (handleUnauthorized(res.status)) return;

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'No se pudo actualizar la empresa.');
      }

      setShowEditTenantModal(false);
      setSelectedTenantForEdit(null);
      await loadData();
    } catch (err: unknown) {
      setEditTenantError(
        err instanceof Error ? err.message : 'Error de conexion al actualizar la empresa.',
      );
    } finally {
      setIsSavingTenant(false);
    }
  };

  const handleToggleTenantStatus = async (t: TenantItem) => {
    const nextActive = t.status !== 'ACTIVO';
    if (
      !window.confirm(
        nextActive
          ? `Reactivar la empresa "${t.name}"? Sus usuarios podran volver a iniciar sesion.`
          : `Suspender la empresa "${t.name}"? Sus usuarios no podran iniciar sesion ni operar.`,
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/platform/tenants/${encodeURIComponent(t.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: nextActive }),
      });
      if (handleUnauthorized(res.status)) return;
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'No se pudo cambiar el estado de la empresa.');
      }
      await loadData();
    } catch (err: unknown) {
      setLoadError(
        err instanceof Error ? err.message : 'Error de conexion al cambiar el estado.',
      );
    }
  };

  const handleResetOwnerPassword = async (t: TenantItem) => {
    if (
      !window.confirm(
        `Restablecer la contrasena del propietario de "${t.name}"? ` +
          'Se generara una contrasena temporal que solo se mostrara una vez.',
      )
    ) {
      return;
    }

    setIsResetting(t.id);
    try {
      const res = await fetch(
        `/api/platform/tenants/${encodeURIComponent(t.id)}/reset-owner-password`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
      );
      if (handleUnauthorized(res.status)) return;
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'No se pudo restablecer la contrasena.');
      }

      setCredentialReveal({
        title: 'Contrasena temporal del propietario',
        email: data?.owner?.email || t.email,
        password: data?.temporaryPassword || '',
        note:
          'Se muestra UNA sola vez. Entreguela por un canal seguro; las sesiones anteriores deben volver a iniciar sesion con la nueva clave.',
      });
      await loadData();
    } catch (err: unknown) {
      setLoadError(
        err instanceof Error ? err.message : 'Error de conexion al restablecer la contrasena.',
      );
    } finally {
      setIsResetting(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!tenantToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const query = deleteMode === 'hard' ? '?hard=true' : '';
      const res = await fetch(
        `/api/platform/tenants/${encodeURIComponent(tenantToDelete.id)}${query}`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            password: deleteMode === 'hard' ? deletePassword : '',
            reason: deleteReason,
          }),
        },
      );
      if (handleUnauthorized(res.status)) return;

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data?.message ||
            (res.status === 409
              ? 'La empresa tiene transacciones registradas; use la eliminacion logica (suspender).'
              : 'No se pudo eliminar la empresa.'),
        );
      }

      setTenantToDelete(null);
      await loadData();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Error al eliminar la empresa.');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredTenants = tenants.filter((t) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      t.name.toLowerCase().includes(q) ||
      t.tradeName.toLowerCase().includes(q) ||
      t.nit.toLowerCase().includes(q) ||
      t.email.toLowerCase().includes(q) ||
      t.city.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q) ||
      t.plan.toLowerCase().includes(q) ||
      t.status.toLowerCase().includes(q)
    );
  });

  const filteredPendingTenants = pendingTenants.filter((p) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      p.businessName.toLowerCase().includes(q) ||
      p.tradeName.toLowerCase().includes(q) ||
      p.nit.toLowerCase().includes(q) ||
      p.city.toLowerCase().includes(q) ||
      p.ownerFullName.toLowerCase().includes(q) ||
      p.ownerEmail.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q) ||
      p.plan.toLowerCase().includes(q) ||
      p.commercialCategory.toLowerCase().includes(q)
    );
  });

  const filteredAuditEvents = auditEvents.filter((a) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      a.actor.toLowerCase().includes(q) ||
      a.event.toLowerCase().includes(q) ||
      a.details.toLowerCase().includes(q) ||
      a.ip.toLowerCase().includes(q)
    );
  });

  const mrrTotal = tenants
    .filter((t) => t.status === 'ACTIVO')
    .reduce((sum, t) => {
      const p = plans.find((x) => x.code === t.plan);
      const fee = Number(p ? p.priceCOP : (PLAN_FEES[t.plan] ?? 0)) || 0;
      return Number(sum) + fee;
    }, 0);

  const totalInvoices = tenants.reduce((sum, t) => sum + t.invoices, 0);

  return (
    <div className="space-y-6">
      {/* Tarjetas KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-3xl shadow-xs border-0">
          <span className="text-xs font-bold text-slate-500">Tenants Activos</span>
          <div className="text-3xl font-extrabold text-slate-900 mt-2 font-mono tracking-tight">
            {isLoading ? '...' : tenants.filter((t) => t.status === 'ACTIVO').length}
          </div>
          <div className="text-[11px] font-semibold text-slate-500 mt-1">
            {tenants.length} empresa(s) en la plataforma
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl shadow-xs border-0">
          <span className="text-xs font-bold text-slate-500">MRR Suscripciones</span>
          <div className="text-3xl font-extrabold text-slate-900 mt-2 font-mono tracking-tight">
            {formatCOP(mrrTotal)}
          </div>
          <div className="text-[11px] font-semibold text-slate-500 mt-1">
            Calculado sobre empresas activas y su plan
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl shadow-xs border-0">
          <span className="text-xs font-bold text-slate-500">Salud Ecosistema</span>
          <div className="text-3xl font-extrabold text-slate-900 mt-2 font-mono tracking-tight">
            Sin datos
          </div>
          <div className="text-[11px] font-semibold text-slate-500 mt-1">Monitoreo no configurado</div>
        </div>

        <div className="bg-white p-5 rounded-3xl shadow-xs border-0">
          <span className="text-xs font-bold text-slate-500">Comprobantes Registrados</span>
          <div className="text-3xl font-extrabold text-slate-900 mt-2 font-mono tracking-tight">
            {isLoading ? '...' : totalInvoices}
          </div>
          <div className="text-[11px] font-semibold text-slate-500 mt-1">
            Total historico en todas las empresas
          </div>
        </div>
      </div>

      {loadError && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl flex items-center justify-between gap-3">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => loadData()}
            className="px-2.5 py-1 bg-white border border-rose-200 rounded-xl font-bold"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Pestanas */}
      <div className="flex items-center space-x-2 border-b border-slate-200/80 overflow-x-auto">
        <button
          type="button"
          onClick={() => handleTabChange('tenants')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'tenants'
              ? 'border-[#18668F] text-[#18668F]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Gestion de Empresas ({tenants.length})
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('squads')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'squads'
              ? 'border-[#18668F] text-[#18668F]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Salud de Microservicios (8 Squads)
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('planes')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'planes'
              ? 'border-[#18668F] text-[#18668F]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Planes y Tarifas SaaS
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('auditoria')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'auditoria'
              ? 'border-[#18668F] text-[#18668F]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Auditoria Global ({auditEvents.length})
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('pendientes')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
            activeTab === 'pendientes'
              ? 'border-[#18668F] text-[#18668F]'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <span>Solicitudes Pendientes</span>
          {pendingTenants.length > 0 ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#F5A51D] text-white">
              {pendingTenants.length}
            </span>
          ) : (
            <span className="text-[11px] font-medium text-slate-400">(0)</span>
          )}
        </button>
      </div>

      {/* Pestana 1: Empresas */}
      {activeTab === 'tenants' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-3xl shadow-xs border-0">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por razon social, NIT o UUID de tenant..."
                value={searchQuery}
                onChange={(e) => handlePageSearchChange(e.target.value)}
                className="w-full pl-10 pr-9 py-2 bg-[#F3F5F9] rounded-2xl text-xs text-slate-800 placeholder-slate-400 border-0 focus:ring-2 focus:ring-[#18668F] focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => loadData()}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-2xl transition-colors flex items-center space-x-1.5"
                title="Recargar datos reales"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Actualizar</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreateTenantError(null);
                  setShowNewTenantModal(true);
                }}
                className="px-4 py-2 bg-[#18668F] hover:bg-[#135273] text-white text-xs font-bold rounded-2xl shadow-xs transition-colors flex items-center space-x-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Dar de Alta Nueva Empresa</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl overflow-hidden shadow-xs border-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-[11px] font-bold text-slate-400 border-b border-slate-100 bg-slate-50/70">
                    <th className="py-3.5 px-5">Empresa / Razon Social</th>
                    <th className="py-3.5 px-4">NIT</th>
                    <th className="py-3.5 px-4">Plan</th>
                    <th className="py-3.5 px-4 text-center">Sucursales / Usuarios</th>
                    <th className="py-3.5 px-4 text-center">Productos / Comprobantes</th>
                    <th className="py-3.5 px-4 text-center">Alta</th>
                    <th className="py-3.5 px-4 text-center">Estado</th>
                    <th className="py-3.5 px-5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                        <div className="font-bold text-slate-700 text-xs">
                          Cargando empresas desde el servicio de plataforma...
                        </div>
                      </td>
                    </tr>
                  ) : filteredTenants.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <div className="font-bold text-slate-700 text-xs">
                          {tenants.length === 0
                            ? 'Aun no hay empresas registradas'
                            : 'Sin resultados para la busqueda'}
                        </div>
                        <div className="text-[11px] mt-1">
                          {tenants.length === 0
                            ? 'Use "Dar de Alta Nueva Empresa" para provisionar el primer tenant.'
                            : 'Ajuste el termino de busqueda por razon social, NIT o UUID.'}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredTenants.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-5">
                          <div className="font-bold text-slate-900">{t.name}</div>
                          <div className="flex items-center space-x-1.5 mt-0.5">
                            <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-100">
                              {t.id.length > 16 ? `${t.id.slice(0, 8)}...${t.id.slice(-4)}` : t.id}
                            </span>
                            <button
                              type="button"
                              onClick={() => navigator.clipboard.writeText(t.id)}
                              title="Copiar UUID tecnico completo"
                              className="text-[10px] font-bold text-slate-400 hover:text-[#18668F] transition-colors"
                            >
                              Copiar
                            </button>
                          </div>
                          {t.city && (
                            <div className="text-[10px] text-slate-400 mt-0.5">{t.city}</div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">{t.nit || '-'}</td>
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-blue-50 text-[#18668F]">
                            {t.plan}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono text-slate-600">
                          {t.branches} / {t.users}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono text-slate-600">
                          {t.products} / {t.invoices}
                        </td>
                        <td className="py-3.5 px-4 text-center text-[10px] font-mono text-slate-500">
                          {formatDate(t.createdAt)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              t.status === 'ACTIVO'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {t.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(t)}
                              className="px-2.5 py-1 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
                              title="Editar razon social, NIT, plan y estado"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleResetOwnerPassword(t)}
                              disabled={isResetting === t.id}
                              className="px-2.5 py-1 text-[11px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl transition-colors disabled:opacity-60 inline-flex items-center gap-1"
                              title="Restablecer contrasena del propietario"
                            >
                              {isResetting === t.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <KeyRound className="w-3 h-3" />
                              )}
                              <span>Clave</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleTenantStatus(t)}
                              className={`px-2.5 py-1 text-[11px] font-bold rounded-xl transition-colors ${
                                t.status === 'ACTIVO'
                                  ? 'bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-600'
                                  : 'bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-600'
                              }`}
                            >
                              {t.status === 'ACTIVO' ? 'Suspender' : 'Reactivar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setTenantToDelete(t);
                                setDeleteMode('soft');
                                setDeleteError(null);
                                setDeletePassword('');
                                setDeleteReason('');
                              }}
                              className="px-2.5 py-1 text-[11px] font-bold bg-slate-100 hover:bg-rose-600 hover:text-white text-slate-600 rounded-xl transition-colors inline-flex items-center gap-1"
                              title="Eliminar empresa"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Eliminar</span>
                            </button>
                          </div>
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

      {/* Pestana 2: Salud de Microservicios */}
      {activeTab === 'squads' && (
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-3xl shadow-xs border-0">
            <h2 className="text-sm font-extrabold text-slate-900 mb-1">
              Topologia y Monitoreo de los 8 Microservicios UNISAAS
            </h2>
            <p className="text-xs text-slate-500 mb-5">
              Arquitectura hexagonal con aislamiento RLS forzado en tiempo de ejecucion
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {[
                { id: 'sq1', name: 'Squad 1: Core Auth & RLS RBAC', port: '3001', healthPath: '/health' },
                { id: 'sq2', name: 'Squad 2: Accounting Engine Ledger', port: '3002', healthPath: '/health' },
                { id: 'sq3', name: 'Squad 3: Inventory Kardex CPP', port: '3003', healthPath: '/health' },
                { id: 'sq4', name: 'Squad 4: Web Desktop POS NextJS', port: '3000', healthPath: '/api/health' },
                { id: 'sq5', name: 'Squad 5: Mobile POS Offline (Flutter)', port: 'App Nativa', healthPath: 'SyncWorker SQLite' },
                { id: 'sq6', name: 'Squad 6: Reports & Impresion ESC/POS', port: '3006', healthPath: '/health' },
                { id: 'sq7', name: 'Squad 7: Credits & Supplier Purchases', port: '3007', healthPath: '/health' },
                { id: 'sq8', name: 'Squad 8: DevOps SRE, Postgres & Redis', port: '9090 / 5432', healthPath: '/-/healthy' },
              ].map((sq) => (
                <div
                  key={sq.id}
                  className="p-4 rounded-2xl bg-[#F8F9FA] border-0 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-300 shrink-0" />
                    <div>
                      <div className="font-bold text-xs text-slate-900">{sq.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        Puerto {sq.port} · Ruta: {sq.healthPath}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-600">
                      SIN MONITOREO
                    </span>
                    <div className="text-[10px] text-slate-400 font-mono mt-1">Latencia: sin medicion</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pestana 3: Planes y Tarifas Dinamicas */}
      {activeTab === 'planes' && (
        <div className="space-y-6">
          {/* Header de la seccion */}
          <div className="bg-white rounded-3xl p-6 shadow-xs border-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Control Maestro de Tarifas y Cuotas SaaS
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                Configuracion en tiempo real de tarifas mensuales en COP, cuotas operativas y estado
                de activacion. Los cambios persisten en PostgreSQL y actualizan inmediatamente el
                calculo de MRR de la plataforma. Soporta desde Plan Free ($0) hasta Enterprise.
              </p>
            </div>
            <button
              type="button"
              onClick={() => loadData()}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl inline-flex items-center gap-2 transition-colors self-start sm:self-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Actualizar Catalogo
            </button>
          </div>

          {/* Notificaciones de exito o error */}
          {planSaveSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-medium flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{planSaveSuccess}</span>
              </div>
              <button
                type="button"
                onClick={() => setPlanSaveSuccess(null)}
                className="text-emerald-700 hover:text-emerald-900 text-xs font-bold"
              >
                Cerrar
              </button>
            </div>
          )}

          {planSaveError && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-medium flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{planSaveError}</span>
              </div>
              <button
                type="button"
                onClick={() => setPlanSaveError(null)}
                className="text-rose-700 hover:text-rose-900 text-xs font-bold"
              >
                Cerrar
              </button>
            </div>
          )}

          {/* Cuadricula de tarjetas de planes */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {(plans.length > 0
              ? plans
              : (['FREE', 'BASICO', 'PYME_PRO', 'RESTAURANTE_PRO', 'ENTERPRISE'] as PlanCode[]).map(
                  (code, idx) => ({
                    code,
                    name: PLAN_LABELS[code].split('(')[0].trim(),
                    priceCOP: PLAN_FEES[code],
                    billingCycle: 'MONTHLY',
                    tagline: 'Configuracion base del sistema',
                    badge: code === 'PYME_PRO' ? 'MAS POPULAR' : code,
                    colorAccent: '#18668F',
                    maxPosTerminals: code === 'FREE' || code === 'BASICO' ? 1 : code === 'PYME_PRO' ? 3 : 8,
                    maxBranches: code === 'RESTAURANTE_PRO' ? 3 : 1,
                    maxInvoicesPerMonth: code === 'FREE' ? 100 : code === 'BASICO' ? 500 : -1,
                    features: ['Facturacion POS', 'Impresion ESC/POS', 'Aislamiento RLS'],
                    isActive: true,
                    displayOrder: idx,
                    updatedAt: new Date().toISOString(),
                  }),
                )
            ).map((p) => {
              const isEditing = editingPlanCode === p.code;
              const isPopular = p.code === 'PYME_PRO';
              const isFree = p.priceCOP === 0;

              return (
                <div
                  key={p.code}
                  className={`bg-white p-5 rounded-3xl shadow-xs border-0 space-y-4 relative flex flex-col justify-between ${
                    isPopular ? 'ring-2 ring-[#18668F]' : ''
                  }`}
                >
                  {isPopular && (
                    <span className="absolute -top-3 right-6 px-3 py-0.5 rounded-full text-[9px] font-extrabold bg-[#18668F] text-white uppercase tracking-wider">
                      MAS POPULAR
                    </span>
                  )}

                  <div className="space-y-3">
                    {/* Header: Badge y Toggle Activo */}
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold uppercase ${
                          isFree
                            ? 'bg-emerald-50 text-emerald-700'
                            : p.code === 'PYME_PRO'
                            ? 'bg-blue-50 text-[#18668F]'
                            : p.code === 'RESTAURANTE_PRO'
                            ? 'bg-purple-50 text-purple-700'
                            : p.code === 'ENTERPRISE'
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {p.badge || p.code}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleTogglePlanActive(p)}
                        title="Haz clic para activar o pausar este plan"
                        className={`px-2 py-0.5 rounded-lg text-[9px] font-bold transition-colors ${
                          p.isActive
                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {p.isActive ? 'Activo' : 'Pausado'}
                      </button>
                    </div>

                    {/* Nombre y Tagline */}
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">{p.name}</h3>
                      {p.tagline && (
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug line-clamp-2">
                          {p.tagline}
                        </p>
                      )}
                    </div>

                    {/* Precio y Modo Edicion */}
                    <div className="pt-1">
                      {isEditing ? (
                        <div className="p-3 bg-[#F8FAFC] rounded-2xl space-y-2.5 border border-blue-100">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Tarifa Mensual (COP):
                            </label>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-bold text-slate-400 font-mono">$</span>
                              <input
                                type="number"
                                min="0"
                                step="1000"
                                value={editPriceCOP}
                                onChange={(e) => setEditPriceCOP(Math.max(0, Number(e.target.value)))}
                                className="w-full p-2 bg-white rounded-xl text-slate-900 font-bold font-mono text-sm border border-slate-200 focus:ring-2 focus:ring-[#18668F]"
                              />
                            </div>
                            {/* Accesos rapidos a tarifas */}
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              <button
                                type="button"
                                onClick={() => setEditPriceCOP(0)}
                                className="px-1.5 py-0.5 text-[9px] font-bold bg-emerald-100 text-emerald-800 rounded-md hover:bg-emerald-200"
                              >
                                $0 Free
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditPriceCOP(45000)}
                                className="px-1.5 py-0.5 text-[9px] font-bold bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300"
                              >
                                $45K
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditPriceCOP(89000)}
                                className="px-1.5 py-0.5 text-[9px] font-bold bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200"
                              >
                                $89K
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditPriceCOP(160000)}
                                className="px-1.5 py-0.5 text-[9px] font-bold bg-purple-100 text-purple-800 rounded-md hover:bg-purple-200"
                              >
                                $160K
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Nombre Comercial:
                            </label>
                            <input
                              type="text"
                              value={editPlanName}
                              onChange={(e) => setEditPlanName(e.target.value)}
                              className="w-full p-1.5 bg-white rounded-xl text-slate-900 font-bold text-xs border border-slate-200 focus:ring-2 focus:ring-[#18668F]"
                            />
                          </div>

                          <div className="flex items-center gap-1.5 pt-1">
                            <button
                              type="button"
                              disabled={isSavingPlan}
                              onClick={() => handleSavePlan(p.code)}
                              className="flex-1 py-1.5 bg-[#18668F] hover:bg-[#135273] text-white text-[11px] font-bold rounded-xl transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-1"
                            >
                              {isSavingPlan && <Loader2 className="w-3 h-3 animate-spin" />}
                              Guardar
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEditPlan}
                              className="py-1.5 px-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[11px] font-bold rounded-xl transition-colors"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="text-2xl font-extrabold text-slate-900 font-mono tracking-tight">
                            {isFree ? (
                              <span className="text-emerald-600">$ 0</span>
                            ) : (
                              <span>{formatCOP(p.priceCOP)}</span>
                            )}
                            <span className="text-xs text-slate-500 font-normal font-sans ml-1">
                              / mes {isFree && '(Gratis)'}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleStartEditPlan(p)}
                            className="mt-2.5 w-full py-1.5 px-3 bg-[#F3F5F9] hover:bg-blue-50 hover:text-[#18668F] text-slate-700 text-[11px] font-bold rounded-xl inline-flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                            Modificar Tarifa
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Resumen de Limites Operativos */}
                    <div className="bg-[#F8FAFC] p-3 rounded-2xl text-[11px] text-slate-600 space-y-1 font-medium">
                      <div className="flex justify-between">
                        <span>Cajas Mostrador:</span>
                        <strong className="text-slate-900">
                          {p.maxPosTerminals === -1 ? 'Ilimitadas' : p.maxPosTerminals}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Sucursales:</span>
                        <strong className="text-slate-900">
                          {p.maxBranches === -1 ? 'Ilimitadas' : p.maxBranches}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Comprobantes:</span>
                        <strong className="text-slate-900">
                          {p.maxInvoicesPerMonth === -1 ? 'Ilimitados' : `${p.maxInvoicesPerMonth}/mes`}
                        </strong>
                      </div>
                    </div>

                    {/* Caracteristicas */}
                    <ul className="text-xs text-slate-600 space-y-2 border-t border-slate-100 pt-3">
                      {(p.features || []).map((feat: string, fIdx: number) => (
                        <li key={fIdx} className="flex items-start gap-1.5 leading-snug">
                          <span className="text-[#18668F] font-bold leading-none mt-0.5">•</span>
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Footer de Tarjeta con metadatos */}
                  <div className="text-[10px] text-slate-400 border-t border-slate-100 pt-3 flex items-center justify-between">
                    <span>
                      Codigo: <code className="font-mono text-slate-700 font-bold">{p.code}</code>
                    </span>
                    <span>Act: {p.updatedAt ? formatDate(p.updatedAt).split(' ')[0] : 'Hoy'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pestana 4: Auditoria global */}
      {activeTab === 'auditoria' && (
        <div className="bg-white rounded-3xl p-6 shadow-xs border-0 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-900">
              Bitacora de Auditoria Global de Plataforma
            </h2>
            <button
              type="button"
              onClick={() => loadData()}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-xl inline-flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[11px] font-bold text-slate-400 border-b border-slate-100">
                  <th className="pb-3 px-3">Fecha y Hora</th>
                  <th className="pb-3 px-3">Actor / Operador</th>
                  <th className="pb-3 px-3">Evento Registrado</th>
                  <th className="pb-3 px-3">Detalle Tecnico</th>
                  <th className="pb-3 px-3 text-right">Direccion IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAuditEvents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400">
                      <div className="font-bold text-slate-700 text-xs">
                        Sin eventos de auditoria
                      </div>
                      <div className="text-[11px] mt-1">
                        Las acciones del superadministrador se registraran aqui.
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredAuditEvents.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-3 text-slate-500 font-mono whitespace-nowrap">
                        {a.timestamp}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900">{a.actor}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
                          {a.event}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600 max-w-md break-all">{a.details}</td>
                      <td className="py-3 px-3 text-right font-mono text-slate-400">{a.ip}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pestana 5: Solicitudes Pendientes (Gobernanza Anti-bot) */}
      {activeTab === 'pendientes' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-3xl shadow-xs border-0">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">
                Solicitudes de Registro Pendientes de Aprobacion
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Gobernanza activa: revise y autorice comercios antes de habilitar su acceso al POS.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => loadData()}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-2xl transition-colors flex items-center space-x-1.5"
                title="Recargar solicitudes pendientes"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Actualizar</span>
              </button>
            </div>
          </div>

          {pendingActionMsg && (
            <div
              className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between ${
                pendingActionMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              <span>{pendingActionMsg.text}</span>
              <button
                type="button"
                onClick={() => setPendingActionMsg(null)}
                className="text-slate-400 hover:text-slate-700 ml-3"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="bg-white rounded-3xl p-12 text-center text-slate-400 shadow-xs border-0">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#18668F]" />
              <div className="font-bold text-slate-700 text-xs">
                Cargando solicitudes pendientes...
              </div>
            </div>
          ) : filteredPendingTenants.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center text-slate-400 shadow-xs border-0">
              <div className="font-bold text-slate-700 text-sm">
                No hay solicitudes de registro pendientes de aprobacion
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Todos los comercios registrados han sido procesados. Cuando un nuevo usuario complete el formulario de registro manual o Google OAuth, aparecera aqui para su aprobacion.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredPendingTenants.map((pt) => {
                const isBusy = isProcessingPending === pt.id;
                return (
                  <div
                    key={pt.id}
                    className="bg-white rounded-3xl p-5 shadow-xs border-0 space-y-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-slate-900 text-sm">
                            {pt.businessName}
                          </h3>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#F5A51D]/15 text-[#b37207]">
                            PENDING_APPROVAL
                          </span>
                          {pt.authProvider === 'GOOGLE' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-[#18668F]">
                              Google OAuth
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                          UUID: {pt.id} • Registrado el: {pt.createdAt}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleRejectTenant(pt.id, pt.businessName)}
                          className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-2xl transition-colors disabled:opacity-50"
                        >
                          {isBusy ? 'Procesando...' : 'Rechazar y Purgar'}
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleApproveTenant(pt.id)}
                          className="px-4 py-2 bg-[#80BF1F] hover:bg-[#6ea41a] text-white text-xs font-bold rounded-2xl shadow-xs transition-colors flex items-center space-x-1.5 disabled:opacity-50"
                        >
                          {isBusy ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                          <span>Aprobar y Activar</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="bg-slate-50 p-3 rounded-2xl space-y-1">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Datos del Comercio
                        </div>
                        <div className="font-semibold text-slate-800">
                          NIT: {pt.nit || 'No especificado'}
                        </div>
                        <div className="text-slate-600">
                          Categoria: {pt.commercialCategory}
                        </div>
                        <div className="text-slate-600">
                          Ciudad: {pt.city || 'No especificada'}
                        </div>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-2xl space-y-1">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Titular / Propietario
                        </div>
                        <div className="font-semibold text-slate-800">
                          {pt.ownerFullName || 'Sin nombre'}
                        </div>
                        <div className="text-slate-600 truncate" title={pt.ownerEmail}>
                          Correo: {pt.ownerEmail}
                        </div>
                        <div className="text-slate-600">
                          Celular: {pt.ownerPhone || 'No registrado'}
                        </div>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-2xl space-y-1">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Plan y Aislamiento
                        </div>
                        <div className="font-semibold text-slate-800">
                          Plan asignado: {pt.plan}
                        </div>
                        <div className="text-slate-600">
                          Aislamiento: Base de datos Supabase
                        </div>
                        <div className="text-slate-600">
                          Acceso al POS: Bloqueado (403)
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal alta de empresa */}
      {showNewTenantModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 border-0 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-sm">
                Dar de Alta Nueva Empresa (Tenant Multi-Tenant)
              </h3>
              <button
                type="button"
                onClick={() => setShowNewTenantModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTenant} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Razon Social / Nombre:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Asadero y Restaurante Don Pedro"
                    value={newTenantName}
                    onChange={(e) => setNewTenantName(e.target.value)}
                    className="w-full p-2.5 bg-[#F3F5F9] rounded-xl text-slate-900 border-0 focus:ring-2 focus:ring-[#18668F]"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Nombre Comercial:</label>
                  <input
                    type="text"
                    placeholder="Ej. Don Pedro"
                    value={newTenantTradeName}
                    onChange={(e) => setNewTenantTradeName(e.target.value)}
                    className="w-full p-2.5 bg-[#F3F5F9] rounded-xl text-slate-900 border-0 focus:ring-2 focus:ring-[#18668F]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">NIT / Identificacion:</label>
                  <input
                    type="text"
                    placeholder="901.888.777-2"
                    value={newTenantNit}
                    onChange={(e) => setNewTenantNit(e.target.value)}
                    className="w-full p-2.5 bg-[#F3F5F9] rounded-xl text-slate-900 font-mono border-0 focus:ring-2 focus:ring-[#18668F]"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Plan de Suscripcion:</label>
                  <select
                    value={newTenantPlan}
                    onChange={(e) => setNewTenantPlan(e.target.value as PlanCode)}
                    className="w-full p-2.5 bg-[#F3F5F9] rounded-xl text-slate-900 font-bold border-0 focus:ring-2 focus:ring-[#18668F]"
                  >
                    {plans.length > 0
                      ? plans
                          .filter((p) => p.isActive)
                          .map((p) => (
                            <option key={p.code} value={p.code}>
                              {p.name} ({p.priceCOP === 0 ? 'Gratis' : `${formatCOP(p.priceCOP)}/mes`})
                            </option>
                          ))
                      : (Object.keys(PLAN_LABELS) as PlanCode[]).map((code) => (
                          <option key={code} value={code}>
                            {PLAN_LABELS[code]}
                          </option>
                        ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Rubro Comercial:</label>
                  <select
                    value={newTenantCategory}
                    onChange={(e) => setNewTenantCategory(e.target.value)}
                    className="w-full p-2.5 bg-[#F3F5F9] rounded-xl text-slate-900 border-0 focus:ring-2 focus:ring-[#18668F]"
                  >
                    {CATEGORY_OPTIONS.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.label}
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
                    placeholder="Calle 10 # 5-20"
                    value={newTenantAddress}
                    onChange={(e) => setNewTenantAddress(e.target.value)}
                    className="w-full p-2.5 bg-[#F3F5F9] rounded-xl text-slate-900 border-0 focus:ring-2 focus:ring-[#18668F]"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Ciudad:</label>
                  <input
                    type="text"
                    placeholder="Bogota"
                    value={newTenantCity}
                    onChange={(e) => setNewTenantCity(e.target.value)}
                    className="w-full p-2.5 bg-[#F3F5F9] rounded-xl text-slate-900 border-0 focus:ring-2 focus:ring-[#18668F]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Nombre Dueno (Owner):</label>
                  <input
                    type="text"
                    required
                    placeholder="Pedro Perez"
                    value={newTenantOwnerName}
                    onChange={(e) => setNewTenantOwnerName(e.target.value)}
                    className="w-full p-2.5 bg-[#F3F5F9] rounded-xl text-slate-900 border-0 focus:ring-2 focus:ring-[#18668F]"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Email Dueno:</label>
                  <input
                    type="email"
                    required
                    placeholder="pedro@empresa.com"
                    value={newTenantOwnerEmail}
                    onChange={(e) => setNewTenantOwnerEmail(e.target.value)}
                    className="w-full p-2.5 bg-[#F3F5F9] rounded-xl text-slate-900 border-0 focus:ring-2 focus:ring-[#18668F]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Telefono del Dueno:</label>
                <input
                  type="text"
                  placeholder="+57 300 123 4567"
                  value={newTenantOwnerPhone}
                  onChange={(e) => setNewTenantOwnerPhone(e.target.value)}
                  className="w-full p-2.5 bg-[#F3F5F9] rounded-xl text-slate-900 border-0 focus:ring-2 focus:ring-[#18668F]"
                />
              </div>

              <div className="p-3 bg-blue-50 border border-blue-100 rounded-2xl text-[11px] text-blue-900 leading-relaxed">
                Se crearan automaticamente el tenant, la sucursal principal, la bodega,
                el usuario OWNER, el PUC, las unidades de medida y la categoria GENERAL.
                Si no define contrasena, el sistema generara una temporal y la mostrara
                una sola vez.
              </div>

              {createTenantError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
                  {createTenantError}
                </div>
              )}

              <div className="flex items-center space-x-2 pt-3">
                <button
                  type="submit"
                  disabled={isCreatingTenant}
                  className="flex-1 py-2.5 bg-[#18668F] hover:bg-[#135273] text-white font-bold text-xs rounded-xl transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
                >
                  {isCreatingTenant && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isCreatingTenant ? 'Provisionando...' : 'Provisionar Empresa'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewTenantModal(false)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal edicion */}
      {showEditTenantModal && selectedTenantForEdit && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border-0">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">
                  Editar Identificacion, Plan y Estado
                </h3>
                <p className="text-[10px] text-slate-400 font-mono truncate max-w-xs">
                  ID: {selectedTenantForEdit.id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditTenantModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditTenant} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Razon Social / Nombre:
                  </label>
                  <input
                    type="text"
                    required
                    value={editTenantName}
                    onChange={(e) => setEditTenantName(e.target.value)}
                    className="w-full p-2.5 bg-[#F3F5F9] rounded-xl text-slate-900 font-bold border-0 focus:ring-2 focus:ring-[#18668F]"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">NIT / Identificacion:</label>
                  <input
                    type="text"
                    value={editTenantNit}
                    onChange={(e) => setEditTenantNit(e.target.value)}
                    className="w-full p-2.5 bg-[#F3F5F9] rounded-xl text-slate-900 font-mono border-0 focus:ring-2 focus:ring-[#18668F]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Plan de Suscripcion SaaS:
                </label>
                <select
                  value={editTenantPlan}
                  onChange={(e) => setEditTenantPlan(e.target.value as PlanCode)}
                  className="w-full p-2.5 bg-[#F3F5F9] rounded-xl text-slate-900 font-bold border-0 focus:ring-2 focus:ring-[#18668F]"
                >
                  {plans.length > 0
                    ? plans
                        .filter((p) => p.isActive)
                        .map((p) => (
                          <option key={p.code} value={p.code}>
                            {p.name} ({p.priceCOP === 0 ? 'Gratis' : `${formatCOP(p.priceCOP)}/mes`})
                          </option>
                        ))
                    : (Object.keys(PLAN_LABELS) as PlanCode[]).map((code) => (
                        <option key={code} value={code}>
                          {PLAN_LABELS[code]}
                        </option>
                      ))}
                </select>
              </div>

              <label className="flex items-center gap-2 p-3 bg-[#F3F5F9] rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={editTenantActive}
                  onChange={(e) => setEditTenantActive(e.target.checked)}
                  className="w-4 h-4 accent-[#18668F]"
                />
                <span className="font-bold text-slate-700">
                  Empresa activa (si se desmarca, sus usuarios no podran iniciar sesion)
                </span>
              </label>

              {editTenantError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
                  {editTenantError}
                </div>
              )}

              <div className="flex items-center space-x-2 pt-3">
                <button
                  type="submit"
                  disabled={isSavingTenant}
                  className="flex-1 py-2.5 bg-[#18668F] hover:bg-[#135273] text-white font-bold text-xs rounded-xl transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
                >
                  {isSavingTenant && <Loader2 className="w-4 h-4 animate-spin" />}
                  Guardar Modificaciones
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditTenantModal(false)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal eliminacion */}
      {tenantToDelete && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border-0">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-sm">Eliminar empresa</h3>
              <button
                type="button"
                onClick={() => setTenantToDelete(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Empresa: <strong>{tenantToDelete.name}</strong>
              <br />
              NIT: <span className="font-mono">{tenantToDelete.nit || '-'}</span>
            </p>

            <div className="space-y-2 text-xs">
              <label className="flex items-start gap-2 p-3 bg-[#F3F5F9] rounded-xl cursor-pointer">
                <input
                  type="radio"
                  name="deleteMode"
                  checked={deleteMode === 'soft'}
                  onChange={() => setDeleteMode('soft')}
                  className="mt-0.5 accent-[#18668F]"
                />
                <span>
                  <strong>Suspender (soft delete)</strong>
                  <span className="block text-[11px] text-slate-500">
                    Desactiva el acceso de todos los usuarios. Los datos se conservan.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 p-3 bg-rose-50 rounded-xl cursor-pointer">
                <input
                  type="radio"
                  name="deleteMode"
                  checked={deleteMode === 'hard'}
                  onChange={() => setDeleteMode('hard')}
                  className="mt-0.5 accent-rose-600"
                />
                <span>
                  <strong className="text-rose-700">Eliminar definitivamente (hard delete)</strong>
                  <span className="block text-[11px] text-rose-600">
                    Elimina de forma irreversible toda la empresa y sus datos en cascada (productos, ventas, turnos, inventario y usuarios).
                  </span>
                </span>
              </label>
            </div>

            <div className="space-y-2 text-xs">
              <label className="block font-bold text-slate-700">
                Motivo de la eliminacion (minimo 10 caracteres)
              </label>
              <textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                rows={2}
                placeholder="Ej. Cierre definitivo solicitado por el propietario"
                className="w-full p-3 bg-[#F3F5F9] rounded-xl text-slate-900 border-0 focus:ring-2 focus:ring-rose-500 resize-none"
              />
              {deleteMode === 'hard' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Confirme su contrasena de superadministrador
                  </label>
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="Contrasena del superadmin"
                    className="w-full p-2.5 bg-[#F3F5F9] rounded-xl text-slate-900 border-0 focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              )}
            </div>

            {deleteError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-[11px]">
                {deleteError}
              </div>
            )}

            <div className="flex items-center space-x-2 pt-2">
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={
                  isDeleting ||
                  deleteReason.trim().length < 10 ||
                  (deleteMode === 'hard' && deletePassword.length === 0)
                }
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                {deleteMode === 'hard' ? 'Eliminar Definitivamente' : 'Suspender Empresa'}
              </button>
              <button
                type="button"
                onClick={() => setTenantToDelete(null)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal credenciales temporales (una sola vez) */}
      {credentialReveal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border-0">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-sm">{credentialReveal.title}</h3>
              <button
                type="button"
                onClick={() => setCredentialReveal(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200/60 rounded-2xl text-[11px] text-amber-900 leading-relaxed">
              {credentialReveal.note ||
                'Esta informacion se muestra UNA sola vez. Guardela antes de cerrar.'}
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <span className="block text-slate-500 font-bold mb-1">Correo:</span>
                <div className="p-2.5 bg-[#F3F5F9] rounded-xl font-mono text-slate-900 break-all">
                  {credentialReveal.email}
                </div>
              </div>
              <div>
                <span className="block text-slate-500 font-bold mb-1">Contrasena temporal:</span>
                <div className="p-2.5 bg-[#F3F5F9] rounded-xl font-mono text-slate-900 break-all flex items-center justify-between gap-2">
                  <span>{credentialReveal.password}</span>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(credentialReveal.password)}
                    className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-[#18668F]"
                    title="Copiar contrasena"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCredentialReveal(null)}
              className="w-full py-2.5 bg-[#18668F] hover:bg-[#135273] text-white font-bold text-xs rounded-xl transition-colors"
            >
              Entendido, ya la guarde
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PlatformAdminPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-xs text-slate-400 font-medium">
          Cargando consola de plataforma...
        </div>
      }
    >
      <PlatformAdminContent />
    </Suspense>
  );
}
