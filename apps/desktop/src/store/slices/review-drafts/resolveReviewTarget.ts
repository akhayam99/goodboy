import type { ReviewablePrProvider, SessionExternalTask, SessionId } from '@goodboy/types';
import type { GetFn } from './types';

export type ReviewTarget = {
  readonly provider: ReviewablePrProvider;
  readonly repo: string;
  readonly prNumber: number;
};

type RepoFromTaskParams = {
  readonly task: SessionExternalTask;
};

const repoFromTask = ({ task }: RepoFromTaskParams): string | null => {
  try {
    const pathname = new URL(task.url).pathname;
    if (task.provider === 'github') {
      const segments = pathname.split('/').filter((segment) => segment.length > 0);
      if (segments.length < 2) {
        return null;
      }
      return `${segments[0]}/${segments[1]}`;
    }
    const projectPart = pathname.split('/-/')[0] ?? '';
    const trimmed = projectPart.replace(/^\/+|\/+$/g, '');
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
};

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
};

export const resolveReviewTarget = ({ get, sessionId }: Params): ReviewTarget | null => {
  const tasks = get().sessionExternalTasks[sessionId] ?? [];
  const task =
    tasks.find((candidate) => candidate.provider === 'github' || candidate.provider === 'gitlab') ??
    null;
  if (task == null) {
    return null;
  }
  const prNumber = Number.parseInt(task.externalId, 10);
  if (!Number.isInteger(prNumber) || prNumber <= 0) {
    return null;
  }
  const repo = repoFromTask({ task });
  if (repo == null) {
    return null;
  }
  return { provider: task.provider as ReviewablePrProvider, repo, prNumber };
};
