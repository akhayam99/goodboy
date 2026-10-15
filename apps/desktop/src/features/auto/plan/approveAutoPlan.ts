import type { AutoRefusalCode } from '@goodboy/core';
import { getAutoArtifact, type Database } from '@goodboy/db';
import type { AgentId, ArtifactId, SessionId } from '@goodboy/types';
import { approveArtifact } from '../../../store/slices/auto/approveArtifact';
import { PLAN_REVISING_REASON } from '../../plans/planRevising';

export type AutoPlanApproval =
  | Readonly<{ kind: 'approved'; revision: number }>
  | Readonly<{ kind: 'already_approved'; revision: number }>
  | Readonly<{ kind: 'refused'; code: AutoRefusalCode; message: string }>
  | Readonly<{ kind: 'told_failed'; revision: number; error: unknown }>;

type SendParams = Readonly<{
  sessionId: SessionId;
  agentId: AgentId;
  content: string;
}>;

type Params = {
  readonly db: Database;
  readonly sessionId: SessionId;
  readonly rootAgentId: AgentId;
  readonly artifactId: ArtifactId;
  readonly expectedRevision: number;
  readonly send: (params: SendParams) => Promise<void>;
};

type RefusalParams = {
  readonly code: AutoRefusalCode;
};

const REFUSAL_TEXT: Readonly<Partial<Record<AutoRefusalCode, string>>> = {
  artifact_revising: PLAN_REVISING_REASON,
  stale_revision: 'A newer version arrived. Review it before approving.',
  artifact_consumed: 'This plan was already used.',
  artifact_discarded: 'This plan was discarded.',
  artifact_unknown: 'This plan is not part of an Auto conversation.',
};

const refusalText = ({ code }: RefusalParams): string =>
  REFUSAL_TEXT[code] ?? 'The plan could not be approved.';

export const approveAutoPlan = async ({
  db,
  sessionId,
  rootAgentId,
  artifactId,
  expectedRevision,
  send,
}: Params): Promise<AutoPlanApproval> => {
  const before = await getAutoArtifact({ db, artifactId });
  const isAlreadyApproved =
    before?.approvalState === 'approved' && before.approvedRevision === expectedRevision;
  const outcome = await approveArtifact({ db, artifactId, expectedRevision });
  if (outcome.kind === 'refused') {
    return { kind: 'refused', code: outcome.code, message: refusalText({ code: outcome.code }) };
  }
  if (isAlreadyApproved) {
    return { kind: 'already_approved', revision: outcome.revision };
  }
  try {
    await send({ sessionId, agentId: rootAgentId, content: `Approved plan v${outcome.revision}.` });
  } catch (error) {
    return { kind: 'told_failed', revision: outcome.revision, error };
  }
  return { kind: 'approved', revision: outcome.revision };
};
