import type { PullRequestState, SessionExternalTask } from '@goodboy/types';

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

type Params = {
  readonly tasks: ReadonlyArray<SessionExternalTask>;
  readonly currentBranch: string | null;
  readonly branchPrs: ReadonlyArray<PullRequestState>;
};

const workItemKey = ({ task }: { readonly task: SessionExternalTask }): string =>
  `${task.provider}:${task.externalId}:${task.mountWorkspaceId ?? ''}:${task.branch ?? ''}`;

export const buildWorkItems = ({ tasks, currentBranch, branchPrs }: Params): WorkItemGroups => {
  const items = tasks.map((task) => {
    const branch = task.branch ?? null;
    const isOnCurrentBranch = branch == null || currentBranch == null || branch === currentBranch;
    const prs = isOnCurrentBranch ? branchPrs : [];
    return {
      key: workItemKey({ task }),
      task,
      branch,
      prs,
      isOnCurrentBranch,
      isCompleted: prs.length > 0 && prs.every((pr) => pr.state === 'merged'),
    } satisfies WorkItem;
  });
  return {
    current: items.filter((item) => item.isOnCurrentBranch && !item.isCompleted),
    history: items.filter((item) => !item.isOnCurrentBranch || item.isCompleted),
  };
};
