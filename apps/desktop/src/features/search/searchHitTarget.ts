import {
  isSessionExternalTaskProvider,
  type AgentId,
  type ArtifactId,
  type MountId,
  type OpenQuestionId,
  type SearchHit,
  type SessionExternalTask,
  type SessionExternalTaskProvider,
  type SessionId,
  type WorkflowId,
  type WorkspaceId,
} from '@goodboy/types';

export type SearchHitTarget =
  | {
      readonly kind: 'session';
      readonly workspaceId: WorkspaceId | null;
      readonly sessionId: SessionId;
      readonly label: string;
    }
  | {
      readonly kind: 'transcript';
      readonly workspaceId: WorkspaceId | null;
      readonly sessionId: SessionId;
      readonly agentId: AgentId;
      readonly label: string;
    }
  | {
      readonly kind: 'artifact';
      readonly workspaceId: WorkspaceId | null;
      readonly sessionId: SessionId;
      readonly artifactId: ArtifactId;
      readonly isPlan: boolean;
      readonly label: string;
    }
  | {
      readonly kind: 'decision';
      readonly workspaceId: WorkspaceId | null;
      readonly sessionId: SessionId;
      readonly number: number;
      readonly label: string;
    }
  | {
      readonly kind: 'question';
      readonly workspaceId: WorkspaceId | null;
      readonly sessionId: SessionId;
      readonly questionId: OpenQuestionId;
      readonly label: string;
    }
  | {
      readonly kind: 'linked-issue';
      readonly workspaceId: WorkspaceId | null;
      readonly sessionId: SessionId;
      readonly task: SessionExternalTask;
      readonly label: string;
    }
  | {
      readonly kind: 'inbox';
      readonly workspaceId: WorkspaceId;
      readonly provider: SessionExternalTaskProvider;
      readonly recordKey: string;
      readonly label: string;
    }
  | {
      readonly kind: 'review';
      readonly workspaceId: WorkspaceId | null;
      readonly sessionId: SessionId;
      readonly label: string;
    }
  | {
      readonly kind: 'diff';
      readonly workspaceId: WorkspaceId | null;
      readonly sessionId: SessionId;
      readonly mountId: MountId;
      readonly label: string;
    }
  | {
      readonly kind: 'comment';
      readonly workspaceId: WorkspaceId | null;
      readonly sessionId: SessionId;
      readonly commentId: string;
      readonly label: string;
    }
  | {
      readonly kind: 'workflow';
      readonly workspaceId: WorkspaceId;
      readonly workflowId: WorkflowId;
      readonly label: string;
    }
  | { readonly kind: 'url'; readonly url: string; readonly label: string }
  | { readonly kind: 'blocked'; readonly reason: string; readonly label: string };

const PROVIDER_NAME: Readonly<Record<SessionExternalTaskProvider, string>> = {
  linear: 'Linear',
  jira: 'Jira',
  github: 'GitHub',
  gitlab: 'GitLab',
  bitbucket: 'Bitbucket',
  sentry: 'Sentry',
  slack: 'Slack',
};

const RECORD_KIND: Readonly<Record<SessionExternalTaskProvider, string>> = {
  linear: 'issue',
  jira: 'issue',
  github: 'issue',
  gitlab: 'issue',
  bitbucket: 'pr',
  sentry: 'error',
  slack: 'thread',
};

type Params = {
  readonly hit: SearchHit;
};

const plainTitle = ({ hit }: Params): string => hit.title.map((segment) => segment.text).join('');

const ARCHIVED = 'This session is archived. Restore it from the archive to open it.';
const GONE = 'The session this belongs to is gone.';

const viaUrl = ({ hit }: Params): SearchHitTarget => {
  if (hit.url === null) {
    return { kind: 'blocked', reason: 'No session and no link to open.', label: 'Open' };
  }
  const provider =
    hit.provider !== null && isSessionExternalTaskProvider(hit.provider)
      ? PROVIDER_NAME[hit.provider]
      : 'the browser';
  return { kind: 'url', url: hit.url, label: `Open in ${provider}` };
};

const sessionBound = ({ hit }: Params): SearchHitTarget | null => {
  if (hit.sessionId === null) {
    return null;
  }
  if (hit.isArchived) {
    return { kind: 'blocked', reason: ARCHIVED, label: 'Open' };
  }
  const base = { workspaceId: hit.workspaceId, sessionId: hit.sessionId };
  switch (hit.kind) {
    case 'session':
      return { kind: 'session', ...base, label: 'Open session' };
    case 'agent':
    case 'message':
      return hit.agentId === null
        ? { kind: 'blocked', reason: 'The agent that wrote this is gone.', label: 'Open' }
        : {
            kind: 'transcript',
            ...base,
            agentId: hit.agentId,
            label: hit.kind === 'agent' ? 'Open agent' : 'Open in transcript',
          };
    case 'plan':
    case 'report':
    case 'wireframe':
      return {
        kind: 'artifact',
        ...base,
        artifactId: hit.refId as ArtifactId,
        isPlan: hit.kind === 'plan',
        label: `Open ${hit.kind}`,
      };
    case 'decision':
      return hit.ordinal === null
        ? { kind: 'blocked', reason: 'This decision is gone.', label: 'Open' }
        : { kind: 'decision', ...base, number: hit.ordinal, label: 'Open in Context' };
    case 'question':
      return {
        kind: 'question',
        ...base,
        questionId: hit.refId as OpenQuestionId,
        label: 'Open in Questions',
      };
    case 'issue':
      return hit.provider !== null && isSessionExternalTaskProvider(hit.provider)
        ? {
            kind: 'linked-issue',
            ...base,
            task: {
              sessionId: hit.sessionId,
              provider: hit.provider,
              externalId: hit.refId,
              identifier: hit.container ?? hit.refId,
              url: hit.url ?? '',
              title: plainTitle({ hit }),
              createdAt: hit.occurredAt,
            },
            label: `Open the ${PROVIDER_NAME[hit.provider]} issue`,
          }
        : viaUrl({ hit });
    case 'pr':
      return { kind: 'review', ...base, label: 'Open comments' };
    case 'branch':
      return hit.status === 'detached' || hit.mountId === null
        ? {
            kind: 'blocked',
            reason: 'This branch is no longer in the session, so there is no diff to show.',
            label: 'Open files',
          }
        : { kind: 'diff', ...base, mountId: hit.mountId, label: 'Open files' };
    case 'comment':
      return { kind: 'comment', ...base, commentId: hit.refId, label: 'Open comments' };
    case 'workflow':
      return null;
    default: {
      const exhaustive: never = hit.kind;
      return exhaustive;
    }
  }
};

export const searchHitTarget = ({ hit }: Params): SearchHitTarget => {
  const bound = sessionBound({ hit });
  if (bound !== null) {
    return bound;
  }
  if (hit.kind === 'issue' && hit.docId.startsWith('starred:')) {
    if (
      hit.workspaceId === null ||
      hit.provider === null ||
      !isSessionExternalTaskProvider(hit.provider)
    ) {
      return viaUrl({ hit });
    }
    return {
      kind: 'inbox',
      workspaceId: hit.workspaceId,
      provider: hit.provider,
      recordKey: `${hit.provider}:${RECORD_KIND[hit.provider]}:${hit.refId}`,
      label: 'Open in Inbox',
    };
  }
  if (hit.kind === 'workflow') {
    return hit.workspaceId === null
      ? { kind: 'blocked', reason: 'This workflow is gone.', label: 'Open workflow' }
      : {
          kind: 'workflow',
          workspaceId: hit.workspaceId,
          workflowId: hit.refId as WorkflowId,
          label: 'Open workflow',
        };
  }
  if (hit.kind === 'pr' || hit.kind === 'issue') {
    return viaUrl({ hit });
  }
  return { kind: 'blocked', reason: GONE, label: 'Open' };
};
