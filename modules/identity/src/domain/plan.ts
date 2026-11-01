export interface PlanLimits {
  maxProducts: number; // -1 = ilimitado
  maxMonthlySales: number; // -1 = ilimitado
  maxUsers: number; // -1 = ilimitado
  maxBranches: number; // -1 = ilimitado
  allowOfflineSync: boolean;
  allowPublicCatalog: boolean;
  allowMultiPayment: boolean;
  allowAccountsPayable: boolean;
}

export class Plan {
  constructor(
    public readonly id: string,
    public readonly code: string,
    public name: string,
    public priceCOP: number,
    public billingCycle: 'MONTHLY' | 'ANNUAL' | 'LIFETIME',
    public description: string,
    public limits: PlanLimits,
    public isActive: boolean = true,
    public isPermissivePilot: boolean = false,
  ) {}

  isUnlimited(feature: keyof PlanLimits): boolean {
    if (this.isPermissivePilot) return true;
    const val = this.limits[feature];
    if (typeof val === 'number') return val === -1;
    if (typeof val === 'boolean') return val === true;
    return false;
  }
}

export const SYSTEM_PLANS: Plan[] = [
  new Plan(
    'plan-pilot',
    'PILOT_UNLIMITED',
    'Plan Piloto UniSaaS (Acceso Total)',
    0,
    'LIFETIME',
    'Acceso sin restricciones a todas las funcionalidades operativas durante la fase de validacion y piloto con comercios reales.',
    {
      maxProducts: -1,
      maxMonthlySales: -1,
      maxUsers: -1,
      maxBranches: -1,
      allowOfflineSync: true,
      allowPublicCatalog: true,
      allowMultiPayment: true,
      allowAccountsPayable: true,
    },
    true,
    true, // Permisivo en piloto
  ),
  new Plan(
    'plan-free',
    'COMMUNITY_FREE',
    'Plan Comunitario Basico',
    0,
    'MONTHLY',
    'Para micro-comercios que inician. Registro de ventas basicas y catalogo limitado.',
    {
      maxProducts: 50,
      maxMonthlySales: 100,
      maxUsers: 1,
      maxBranches: 1,
      allowOfflineSync: false,
      allowPublicCatalog: true,
      allowMultiPayment: false,
      allowAccountsPayable: false,
    },
    true,
    false,
  ),
  new Plan(
    'plan-pro',
    'PRO_GROWTH',
    'Plan Pro Crecimiento',
    49000,
    'MONTHLY',
    'Para negocios en expansion con multiples cajeros, cartera y compras.',
    {
      maxProducts: -1,
      maxMonthlySales: -1,
      maxUsers: 5,
      maxBranches: 2,
      allowOfflineSync: true,
      allowPublicCatalog: true,
      allowMultiPayment: true,
      allowAccountsPayable: true,
    },
    true,
    false,
  ),
  new Plan(
    'plan-enterprise',
    'ENTERPRISE_MULTI',
    'Plan Corporativo Multisede',
    129000,
    'MONTHLY',
    'Para cadenas y distribuidoras comerciales con sedes multiples y bodegas.',
    {
      maxProducts: -1,
      maxMonthlySales: -1,
      maxUsers: -1,
      maxBranches: -1,
      allowOfflineSync: true,
      allowPublicCatalog: true,
      allowMultiPayment: true,
      allowAccountsPayable: true,
    },
    true,
    false,
  ),
];
