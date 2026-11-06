import type { PullRequestState, PullRequestStateKind, SessionExternalTask } from '@goodboy/types';

export type WorkItem = Readonly<{
  key: string;
  task: SessionExternalTask;
  branch: string | null;
  prs: ReadonlyArray<PullRequestState>;
  isOnCurrentBranch: boolean;
  isCompleted: boolean;
}>;

export type WorkItemGroups = Readonly<{
  current: ReadonlyArray<WorkItem>;
  history: ReadonlyArray<WorkItem>;
}>;

export type MountBranchState = Readonly<{
  branch: string;
  state: PullRequestStateKind | null;
}>;

type Params = {
  readonly tasks: ReadonlyArray<SessionExternalTask>;
  readonly currentBranch: string | null;
  readonly branchPrs: ReadonlyArray<PullRequestState>;
  readonly mountBranches?: ReadonlyArray<MountBranchState>;
};

const workItemKey = ({ task }: { readonly task: SessionExternalTask }): string =>
  `${task.provider}:${task.externalId}:${task.projectId ?? ''}:${task.branch ?? ''}:${task.scope ?? 'session'}`;

export const buildWorkItems = ({
  tasks,
  currentBranch,
  branchPrs,
  mountBranches = [],
}: Params): WorkItemGroups => {
  const sessionBranches = new Set([
    ...(currentBranch === null ? [] : [currentBranch]),
    ...mountBranches.map(({ branch }) => branch),
  ]);
  const items = tasks.map((task) => {
    const branch = task.branch ?? null;
    const isOnCurrentBranch =
      branch == null || sessionBranches.size === 0 || sessionBranches.has(branch);
    const isActiveBranch = branch == null || branch === currentBranch;
    const prs = isOnCurrentBranch && isActiveBranch ? branchPrs : [];
    const mountStates = mountBranches
      .filter((mount) => mount.branch === branch)
      .map(({ state }) => state);
    const isMountMerged =
      !isActiveBranch && mountStates.length > 0 && mountStates.every((state) => state === 'merged');
    return {
      key: workItemKey({ task }),
      task,
      branch,
      prs,
      isOnCurrentBranch,
      isCompleted: isMountMerged || (prs.length > 0 && prs.every((pr) => pr.state === 'merged')),
    } satisfies WorkItem;
  });
  return {
    current: items.filter((item) => item.isOnCurrentBranch && !item.isCompleted),
    history: items.filter((item) => !item.isOnCurrentBranch || item.isCompleted),
  };
};
