import type { AutoRefusalCode } from '@goodboy/core/auto';
import type { Database } from '@goodboy/db';
import type { AgentId, ArtifactId, SessionId } from '@goodboy/types';
import { approveArtifact } from '../../../store/runtime/auto/approveArtifact';
import { PLAN_REVISING_REASON } from '../../plans/planRevising';
import { approvedPlanTextOf } from './approvedPlanReply';

export type AutoPlanApproval =
  | Readonly<{ kind: 'approved'; revision: number }>
  | Readonly<{ kind: 'already_approved'; revision: number }>
  | Readonly<{ kind: 'refused'; code: AutoRefusalCode; message: string }>
  | Readonly<{ kind: 'told_failed'; revision: number; error: unknown }>;

type SendParams = Readonly<{
  sessionId: SessionId;
  agentId: AgentId;
  content: string;
  focusArtifactId: ArtifactId;
}>;

type Params = {
  readonly db: Database;
  readonly sessionId: SessionId;
  readonly rootAgentId: AgentId;
  readonly artifactId: ArtifactId;
  readonly expectedRevision: number;
  readonly send: (params: SendParams) => Promise<void>;
  readonly onWritten: () => Promise<void>;
};

type RefusalParams = {
  readonly code: AutoRefusalCode;
  readonly expectedRevision: number;
  readonly latestRevision: number | null;
};

const REFUSAL_TEXT: Readonly<Partial<Record<AutoRefusalCode, string>>> = {
  artifact_revising: PLAN_REVISING_REASON,
  stale_revision: 'A newer version arrived. Review it before approving.',
  artifact_consumed: 'This plan was already used.',
  artifact_discarded: 'This plan was discarded.',
  artifact_unknown: "This plan isn't part of an Auto conversation.",
};

const refusalText = ({ code, expectedRevision, latestRevision }: RefusalParams): string => {
  if (code === 'stale_revision' && latestRevision !== null) {
    return `Plan v${expectedRevision} is no longer current. Review v${latestRevision} before approving.`;
  }
  return REFUSAL_TEXT[code] ?? 'The plan could not be approved.';
};

export const approveAutoPlan = async ({
  db,
  sessionId,
  rootAgentId,
  artifactId,
  expectedRevision,
  send,
  onWritten,
}: Params): Promise<AutoPlanApproval> => {
  const outcome = await approveArtifact({ db, artifactId, expectedRevision });
  if (outcome.kind === 'refused') {
    return {
      kind: 'refused',
      code: outcome.code,
      message: refusalText({
        code: outcome.code,
        expectedRevision,
        latestRevision: outcome.latestRevision,
      }),
    };
  }
  if (outcome.kind === 'already_approved') {
    return { kind: 'already_approved', revision: outcome.revision };
  }
  await onWritten();
  try {
    await send({
      sessionId,
      agentId: rootAgentId,
      content: approvedPlanTextOf({ revision: outcome.revision }),
      focusArtifactId: artifactId,
    });
  } catch (error) {
    return { kind: 'told_failed', revision: outcome.revision, error };
  }
  return { kind: 'approved', revision: outcome.revision };
};
