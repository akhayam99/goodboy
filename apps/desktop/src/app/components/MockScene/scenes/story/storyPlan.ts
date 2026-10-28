import type { IsoDateTime, PlanWithCount, ProviderRunId, SessionArtifact } from '@goodboy/types';
import { AUTO_PLAN_ID, AUTO_SESSION, PLANNER_ID } from '../u24/autoSceneSeed';
import { STORY_PLAN } from './storyContent';

type RevisionParams = {
  readonly revision: 1 | 2;
};

type PlanParams = RevisionParams & {
  readonly at: IsoDateTime;
};

type StoredParams = RevisionParams & {
  readonly at: IsoDateTime;
  readonly runId: ProviderRunId;
};

export const storyPlanBodyOf = ({ revision }: RevisionParams): string =>
  [
    `## Goal\n\n${STORY_PLAN.goal}`,
    `## Changes in payments-api\n\n${STORY_PLAN.changes}`,
    [
      `## ${STORY_PLAN.replayHeading}`,
      STORY_PLAN.replayParagraph,
      ...(revision === 2 ? [STORY_PLAN.concurrentParagraph] : []),
    ].join('\n\n'),
    `## Verification against ledger-core\n\n${STORY_PLAN.verification}`,
  ].join('\n\n');

export const storyPlanEnvelopeOf = ({ revision }: RevisionParams): string =>
  [
    '<<artifact v=1 kind=plan>>',
    JSON.stringify({ title: STORY_PLAN.title, content: storyPlanBodyOf({ revision }) }),
    '<</artifact>>',
  ].join('\n');

export const storyPlanOf = ({ revision, at }: PlanParams): PlanWithCount => ({
  id: AUTO_PLAN_ID,
  sessionId: AUTO_SESSION.id,
  agentId: PLANNER_ID,
  title: STORY_PLAN.title,
  bodyMd: storyPlanBodyOf({ revision }),
  status: 'active',
  clusters: STORY_PLAN.clusters.map((cluster) => ({ ...cluster })),
  createdAt: at,
  updatedAt: at,
  consumptionCount: 0,
});

export const storyPlanStoredOf = ({ revision, at, runId }: StoredParams): SessionArtifact => ({
  id: AUTO_PLAN_ID,
  sessionId: AUTO_SESSION.id,
  agentId: PLANNER_ID,
  workflowRunId: null,
  kind: 'plan',
  schemaVersion: 1,
  title: STORY_PLAN.title,
  sourceFormat: 'markdown',
  sourceText: storyPlanBodyOf({ revision }),
  metadata: { clusters: STORY_PLAN.clusters.map((cluster) => ({ ...cluster })) },
  status: 'active',
  revision,
  sourceTurnId: runId,
  createdAt: at,
  updatedAt: at,
  openedAt: null,
});
