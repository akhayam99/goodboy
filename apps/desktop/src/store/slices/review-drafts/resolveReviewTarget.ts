import type { ReviewablePrProvider, SessionExternalTask, SessionId } from '@goodboy/types';
import { PROVIDER_PRIORITY } from '../../../features/session/components/SessionWorkspace/parts/resolvePullRequestProvider';
import { selectActiveProjectPrs } from '../github/activeProjectPrs';
import type { AppState } from '../../types';

export type ReviewTarget = {
  readonly provider: ReviewablePrProvider;
  readonly repo: string;
  readonly prNumber: number;
};

type ReviewableTask = SessionExternalTask & { readonly provider: ReviewablePrProvider };

const isReviewableTask = (task: SessionExternalTask): task is ReviewableTask =>
  task.provider === 'github' || task.provider === 'gitlab';

type RepoFromTaskParams = {
  readonly task: ReviewableTask;
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

type TargetFromTaskParams = {
  readonly task: ReviewableTask;
};

const targetFromTask = ({ task }: TargetFromTaskParams): ReviewTarget | null => {
  const prNumber = Number.parseInt(task.externalId, 10);
  if (!Number.isInteger(prNumber) || prNumber <= 0) {
    return null;
  }
  const repo = repoFromTask({ task });
  if (repo == null) {
    return null;
  }
  return { provider: task.provider, repo, prNumber };
};

type PrKeyParams = {
  readonly provider: ReviewablePrProvider;
  readonly prNumber: number;
};

export const reviewPrKey = ({ provider, prNumber }: PrKeyParams): string =>
  `${provider}#${prNumber}`;

const byProviderThenNumber = (left: ReviewTarget, right: ReviewTarget): number => {
  const rank = PROVIDER_PRIORITY.indexOf(left.provider) - PROVIDER_PRIORITY.indexOf(right.provider);
  if (rank !== 0) {
    return rank;
  }
  return left.prNumber - right.prNumber;
};

type FromTasksParams = {
  readonly tasks: ReadonlyArray<SessionExternalTask>;
  readonly discoveredPrKeys: ReadonlySet<string>;
};

const reviewTargetFromTasks = ({
  tasks,
  discoveredPrKeys,
}: FromTasksParams): ReviewTarget | null => {
  const candidates = tasks
    .filter(isReviewableTask)
    .flatMap((task) => {
      const target = targetFromTask({ task });
      return target == null ? [] : [target];
    })
    .sort(byProviderThenNumber);
  const discovered = candidates.find((candidate) => discoveredPrKeys.has(reviewPrKey(candidate)));
  return discovered ?? candidates[0] ?? null;
};

export type ReviewTargetState = Pick<
  AppState,
  | 'sessionExternalTasks'
  | 'sessionGitlabMr'
  | 'sessions'
  | 'projects'
  | 'sessionProjectMounts'
  | 'sessionActiveProject'
  | 'sessionProjectPrs'
>;

type Params = {
  readonly state: ReviewTargetState;
  readonly sessionId: SessionId;
};

const discoveredPrKeysForSession = ({ state, sessionId }: Params): ReadonlySet<string> => {
  const keys = new Set<string>();
  for (const pr of selectActiveProjectPrs({ state, sessionId })) {
    keys.add(reviewPrKey({ provider: 'github', prNumber: pr.number }));
  }
  const mergeRequest = state.sessionGitlabMr[sessionId]?.mr ?? null;
  if (mergeRequest != null) {
    keys.add(reviewPrKey({ provider: 'gitlab', prNumber: mergeRequest.iid }));
  }
  return keys;
};

export const resolveReviewTarget = ({ state, sessionId }: Params): ReviewTarget | null =>
  reviewTargetFromTasks({
    tasks: state.sessionExternalTasks[sessionId] ?? [],
    discoveredPrKeys: discoveredPrKeysForSession({ state, sessionId }),
  });
