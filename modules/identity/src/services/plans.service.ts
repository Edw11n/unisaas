import { Injectable } from '@nestjs/common';
import { Plan, type PlanLimits, SYSTEM_PLANS } from '../domain/plan.js';

export interface UsageCheckResult {
  allowed: boolean;
  limit: number;
  currentUsage: number;
  isPilotMode: boolean;
  message?: string;
}

@Injectable()
export class PlansService {
  private readonly plans: Plan[] = [...SYSTEM_PLANS];
  private readonly tenantSubscriptions: Map<string, { planCode: string; assignedAt: Date }> = new Map();

  getAvailablePlans(): Plan[] {
    return this.plans.filter((p) => p.isActive);
  }

  getPlanByCode(code: string): Plan {
    const clean = (code || '').toUpperCase().trim();
    const found = this.plans.find((p) => p.code.toUpperCase() === clean);
    return found || this.plans[0]; // Retorna PILOT_UNLIMITED por defecto
  }

  getTenantSubscription(tenantId: string) {
    const sub = this.tenantSubscriptions.get(tenantId);
    const planCode = sub?.planCode || 'PILOT_UNLIMITED';
    const plan = this.getPlanByCode(planCode);

    const isEnforcementActive = process.env.BILLING_ENFORCEMENT_ENABLED === 'true';

    return {
      tenantId,
      planCode: plan.code,
      planName: plan.name,
      priceCOP: plan.priceCOP,
      billingCycle: plan.billingCycle,
      limits: plan.limits,
      isEnforcementActive,
      isPilotMode: !isEnforcementActive || plan.isPermissivePilot,
      assignedAt: sub?.assignedAt || new Date('2026-01-01'),
    };
  }

  assignPlanToTenant(tenantId: string, planCode: string) {
    const plan = this.getPlanByCode(planCode);
    this.tenantSubscriptions.set(tenantId, {
      planCode: plan.code,
      assignedAt: new Date(),
    });
    return this.getTenantSubscription(tenantId);
  }

  checkUsageLimit(
    tenantId: string,
    limitKey: keyof PlanLimits,
    currentUsage: number,
  ): UsageCheckResult {
    const isEnforcementActive = process.env.BILLING_ENFORCEMENT_ENABLED === 'true';
    const sub = this.getTenantSubscription(tenantId);
    const plan = this.getPlanByCode(sub.planCode);

    if (!isEnforcementActive || plan.isPermissivePilot) {
      return {
        allowed: true,
        limit: -1,
        currentUsage,
        isPilotMode: true,
      };
    }

    const limitVal = plan.limits[limitKey];
    if (typeof limitVal === 'number') {
      if (limitVal === -1) {
        return { allowed: true, limit: -1, currentUsage, isPilotMode: false };
      }
      const allowed = currentUsage < limitVal;
      return {
        allowed,
        limit: limitVal,
        currentUsage,
        isPilotMode: false,
        message: allowed
          ? undefined
          : `Has alcanzado el límite de ${limitVal} para ${String(limitKey)} en tu plan actual.`,
      };
    }

    if (typeof limitVal === 'boolean') {
      return {
        allowed: limitVal,
        limit: limitVal ? 1 : 0,
        currentUsage: 1,
        isPilotMode: false,
        message: limitVal ? undefined : `La funcionalidad ${String(limitKey)} no está incluida en tu plan.`,
      };
    }

    return { allowed: true, limit: -1, currentUsage, isPilotMode: false };
  }
}
