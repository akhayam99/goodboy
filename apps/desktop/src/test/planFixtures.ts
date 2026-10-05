import type {
  AgentId,
  ArtifactId,
  IsoDateTime,
  PlanArtifact,
  PlanWithCount,
  SessionId,
} from '@goodboy/types';
import { planAsArtifact } from '../features/plans/planAsArtifact';

export const PLAN_FIXTURE_SESSION = 'session-harborline' as SessionId;
export const PLAN_FIXTURE_PLANNER = 'agent-planner' as AgentId;
export const PLAN_FIXTURE_ID = 'plan-retries' as ArtifactId;
export const PLAN_FIXTURE_AT = '2026-10-05T10:00:00.000Z' as IsoDateTime;

export const aPlan = (overrides: Partial<PlanWithCount> = {}): PlanWithCount => ({
  id: PLAN_FIXTURE_ID,
  sessionId: PLAN_FIXTURE_SESSION,
  agentId: PLAN_FIXTURE_PLANNER,
  title: 'Retry-safe webhook credits',
  bodyMd: '## Goal\nRetried webhooks must never post a second credit.',
  status: 'active',
  createdAt: PLAN_FIXTURE_AT,
  updatedAt: PLAN_FIXTURE_AT,
  consumptionCount: 0,
  ...overrides,
});

export const aStoredPlan = (
  overrides: Partial<PlanArtifact> = {},
  plan: PlanWithCount = aPlan(),
): PlanArtifact => ({
  ...planAsArtifact({ plan, stored: null }),
  revision: 1,
  sourceTurnId: 'run-1',
  ...overrides,
});
