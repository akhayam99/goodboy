import type { IsoDateTime, SessionId, TaskId } from './ids';

export type PlanId = string & { readonly __brand: 'PlanId' };

export type PlanStatus = 'active' | 'consumed' | 'superseded';

export type Plan = Readonly<{
  id: PlanId;
  sessionId: TaskId;
  agentId: SessionId;
  title: string;
  bodyMd: string;
  status: PlanStatus;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}>;

export type PlanWithCount = Plan & Readonly<{ consumptionCount: number }>;

export type PlanConsumptionId = string & { readonly __brand: 'PlanConsumptionId' };

export type PlanConsumption = Readonly<{
  id: PlanConsumptionId;
  planId: PlanId;
  agentId: SessionId;
  agentName: string | null;
  consumedAt: IsoDateTime;
}>;
