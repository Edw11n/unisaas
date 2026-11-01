import {
  Home,
  Store,
  FileText,
  Users,
  Package,
  Receipt,
  Scale,
  BarChart3,
  Settings,
  HelpCircle,
  LucideIcon,
} from 'lucide-react';

export interface NavItemConfig {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number | null;
  description?: string;
}

export const SAAS_NAVIGATION_ITEMS: NavItemConfig[] = [
  { id: 'home', label: 'Inicio', href: '/admin', icon: Home, badge: null },
  { id: 'pos', label: 'Mostrador POS', href: '/pos', icon: Store, badge: null },
  { id: 'balance', label: 'Balance Operativo', href: '/admin/balance', icon: Scale, badge: null },
  { id: 'invoices', label: 'Ventas y Caja', href: '/admin/invoices', icon: FileText, badge: null },
  { id: 'clients', label: 'Clientes y Cuentas', href: '/admin/clients', icon: Users, badge: null },
  { id: 'inventory', label: 'Productos e Inventario', href: '/admin/inventory', icon: Package, badge: null },
  { id: 'gastos', label: 'Gastos y Compras', href: '/admin/gastos', icon: Receipt, badge: null },
  { id: 'reportes', label: 'Reportes', href: '/admin/reportes', icon: BarChart3, badge: null },
  { id: 'team', label: 'Roles y Equipo', href: '/admin/team', icon: Users, badge: null },
  { id: 'settings', label: 'Ajustes y Empresa', href: '/admin/settings', icon: Settings, badge: null },
  { id: 'help', label: 'Ayuda y Atajos', href: '/admin/help', icon: HelpCircle, badge: null },
];

export const POS_DOCK_NAV_ITEMS: NavItemConfig[] = [
  { id: 'home', label: 'Panel Administrativo', href: '/admin', icon: Home },
  { id: 'pos', label: 'Mostrador POS (Activo)', href: '/pos', icon: Store },
  { id: 'balance', label: 'Balance Operativo', href: '/admin/balance', icon: Scale },
  { id: 'invoices', label: 'Ventas y Facturas', href: '/admin/invoices', icon: FileText },
  { id: 'clients', label: 'Clientes y Cuentas', href: '/admin/clients', icon: Users },
  { id: 'inventory', label: 'Productos e Inventario', href: '/admin/inventory', icon: Package },
  { id: 'gastos', label: 'Gastos y Compras', href: '/admin/gastos', icon: Receipt },
  { id: 'team', label: 'Roles y Equipo', href: '/admin/team', icon: Users },
  { id: 'settings', label: 'Ajustes y Empresa', href: '/admin/settings', icon: Settings },
  { id: 'help', label: 'Ayuda y Atajos', href: '/admin/help', icon: HelpCircle },
];

