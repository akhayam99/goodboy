import type { IsoDateTime, SessionId, TaskId } from './ids';

export type PlanId = string & { readonly __brand: 'PlanId' };

export type PlanStatus = 'active' | 'completed' | 'superseded';

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
