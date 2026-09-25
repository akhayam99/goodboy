import type { PlanArtifact, PlanWithCount, SessionArtifact } from '@goodboy/types';

type Params = {
  readonly plan: PlanWithCount;
  readonly stored: SessionArtifact | null;
};

export const planAsArtifact = ({ plan, stored }: Params): PlanArtifact => ({
  id: plan.id,
  sessionId: plan.sessionId,
  agentId: plan.agentId,
  workflowRunId: plan.workflowRunId ?? null,
  kind: 'plan',
  schemaVersion: stored?.schemaVersion ?? 1,
  title: plan.title,
  sourceFormat: 'markdown',
  sourceText: plan.bodyMd,
  metadata: plan.clusters === undefined ? {} : { clusters: plan.clusters },
  status: plan.status,
  revision: stored?.revision ?? 1,
  sourceTurnId: stored?.sourceTurnId ?? null,
  createdAt: plan.createdAt,
  updatedAt: plan.updatedAt,
});

export const planFromArtifact = ({
  artifact,
}: {
  readonly artifact: PlanArtifact;
}): PlanWithCount => ({
  id: artifact.id,
  sessionId: artifact.sessionId,
  agentId: artifact.agentId,
  ...(artifact.workflowRunId !== null && { workflowRunId: artifact.workflowRunId }),
  title: artifact.title,
  bodyMd: artifact.sourceText,
  status: artifact.status,
  ...(artifact.metadata.clusters !== undefined && { clusters: artifact.metadata.clusters }),
  createdAt: artifact.createdAt,
  updatedAt: artifact.updatedAt,
  consumptionCount: 0,
});
