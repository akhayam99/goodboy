import type { Agent } from '@goodboy/types';
import { planApprovalInViewOf } from '../../auto/chat/planApprovalInViewOf';
import type { SessionArtifactRow } from '../contract/projections';
import { actionIdOf } from './actionIdOf';
import { agentRoleOf } from './agentRoleOf';
import { isLeadAgentOf } from './isLeadAgentOf';
import { isoOrNull } from './isoOrNull';
import { safeTextOf } from './safeTextOf';
import type { WorkspaceScope } from './workspaceScope';

export const ARTIFACT_LIMIT = 20;
export const ARTIFACT_BODY_MAX = 6000;
export const ARTIFACT_TITLE_MAX = 200;

type Params = {
  readonly scope: WorkspaceScope;
  readonly sessionId: string;
};

type CountParams = {
  readonly id: string;
};

type BodyParams = {
  readonly text: string;
  readonly isMarkdown: boolean;
};

type Body = {
  readonly body: string | null;
  readonly isBodyCut: boolean;
};

const bodyOf = ({ text, isMarkdown }: BodyParams): Body => {
  if (!isMarkdown) {
    return { body: null, isBodyCut: false };
  }
  return {
    body: safeTextOf({ text, max: ARTIFACT_BODY_MAX }),
    isBodyCut: text.length > ARTIFACT_BODY_MAX,
  };
};

type RoleParams = {
  readonly scope: WorkspaceScope;
  readonly sessionId: string;
  readonly agent: Agent | undefined;
};

const roleOf = ({ scope, sessionId, agent }: RoleParams): string | null =>
  agent === undefined
    ? null
    : agentRoleOf({ agent, isLead: isLeadAgentOf({ scope, sessionId, agent }) });

type RecentParams = {
  readonly left: SessionArtifactRow;
  readonly right: SessionArtifactRow;
};

const byRecent = ({ left, right }: RecentParams): number => {
  const l = left.updatedAt ?? '';
  const r = right.updatedAt ?? '';
  return l < r ? 1 : l > r ? -1 : 0;
};

export const artifactRowsOf = ({ scope, sessionId }: Params): ReadonlyArray<SessionArtifactRow> => {
  const comments = scope.artifactComments[sessionId] ?? [];
  const countOf = ({ id }: CountParams): number =>
    comments.filter((comment) => comment.artifactId === id).length;
  const ledger = (scope.trees[sessionId] ?? []).flatMap((view) =>
    view.artifacts.map((row): SessionArtifactRow => {
      const id = row.artifact.artifactId;
      const isAwaiting =
        row.artifact.kind === 'plan' &&
        planApprovalInViewOf({ view, row })?.state === 'needs_approval';
      return {
        id,
        title: safeTextOf({ text: row.title, max: ARTIFACT_TITLE_MAX }),
        kind: row.artifact.kind,
        role: row.lastAuthor ?? row.artifact.ownerRole,
        version: row.revision,
        updatedAt: isoOrNull({ at: row.updatedAt }),
        commentCount: countOf({ id }),
        isAwaitingApproval: isAwaiting,
        approveActionId: isAwaiting
          ? actionIdOf({ kind: 'approvePlan', objectId: id, version: String(row.revision) })
          : null,
        ...bodyOf({ text: row.sourceText, isMarkdown: row.artifact.kind !== 'wireframe' }),
      };
    }),
  );
  const known = new Set<string>(ledger.map((row) => row.id));
  const agents = scope.agents[sessionId] ?? [];
  const stored = (scope.artifacts[sessionId] ?? [])
    .filter((artifact) => !known.has(artifact.id) && artifact.status !== 'discarded')
    .map((artifact): SessionArtifactRow => ({
      id: artifact.id,
      title: safeTextOf({ text: artifact.title, max: ARTIFACT_TITLE_MAX }),
      kind: artifact.kind,
      role: roleOf({
        scope,
        sessionId,
        agent: agents.find((agent) => agent.id === artifact.agentId),
      }),
      version: artifact.revision,
      updatedAt: artifact.updatedAt,
      commentCount: countOf({ id: artifact.id }),
      isAwaitingApproval: false,
      approveActionId: null,
      ...bodyOf({ text: artifact.sourceText, isMarkdown: artifact.sourceFormat === 'markdown' }),
    }));
  return [...ledger, ...stored].sort((left, right) => byRecent({ left, right }));
};
