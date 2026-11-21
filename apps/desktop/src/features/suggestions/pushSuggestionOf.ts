import type { SessionId } from '@goodboy/types';
import type { SuggestionMount } from './deriveNextSteps';
import type { SessionSuggestion } from './types';

type PushSuggestionParams = {
  readonly mount: SuggestionMount;
  readonly sessionId: SessionId;
};

type PushSuggestion = Extract<SessionSuggestion, { readonly kind: 'push-branch' }>;

type CountParams = {
  readonly count: number;
};

const commitsLabel = ({ count }: CountParams): string =>
  `${count} ${count === 1 ? 'commit' : 'commits'}`;

export const pushSuggestionOf = ({
  mount,
  sessionId,
}: PushSuggestionParams): PushSuggestion | null => {
  const push = mount.push;
  if (push === null) {
    return null;
  }
  const base = {
    id: `push-branch:${mount.mountId}`,
    kind: 'push-branch' as const,
    priority: 41,
    band: 2 as const,
    sessionId,
    targetKey: `branch:${mount.mountId}`,
  };
  const target = {
    mountId: mount.mountId,
    projectId: mount.projectId,
    projectName: mount.projectName,
    branch: mount.branch,
    worktreePath: mount.worktreePath,
  };
  if (push.kind === 'diverged') {
    return {
      ...base,
      title: 'Branch diverged from origin',
      detail: `${commitsLabel({ count: push.ahead })} here, ${commitsLabel({ count: push.behind })} on origin`,
      fingerprint: `push-branch:${mount.mountId}:diverged:${push.ahead}:${push.behind}`,
      payload: { ...target, state: 'diverged', ahead: push.ahead, behind: push.behind },
    };
  }
  if (mount.isClean === false) {
    return null;
  }
  if (push.kind === 'ahead') {
    return {
      ...base,
      title: `Push ${commitsLabel({ count: push.ahead })}`,
      detail: `${mount.projectName} · ${mount.branch}`,
      fingerprint: `push-branch:${mount.mountId}:${push.ahead}`,
      payload: { ...target, state: 'ahead', ahead: push.ahead, behind: 0 },
    };
  }
  if (push.kind === 'not-pushed' && push.commits !== null && push.commits > 0) {
    return {
      ...base,
      title: 'Push the branch',
      detail: `Not pushed yet · ${commitsLabel({ count: push.commits })}`,
      fingerprint: `push-branch:${mount.mountId}:new:${push.commits}`,
      payload: { ...target, state: 'not-pushed', ahead: push.commits, behind: 0 },
    };
  }
  return null;
};
