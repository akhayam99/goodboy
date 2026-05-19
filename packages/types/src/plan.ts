import type { AgentId, IsoDateTime, PlanConsumptionId, PlanId, SessionId } from './ids';

export type PlanStatus = 'active' | 'consumed' | 'superseded';

export type Plan = Readonly<{
  id: PlanId;
  sessionId: SessionId;
  agentId: AgentId;
  title: string;
  bodyMd: string;
  status: PlanStatus;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}>;

export type PlanWithCount = Plan & Readonly<{ consumptionCount: number }>;

export type PlanConsumption = Readonly<{
  id: PlanConsumptionId;
  planId: PlanId;
  agentId: AgentId;
  agentName: string | null;
  consumedAt: IsoDateTime;
}>;
