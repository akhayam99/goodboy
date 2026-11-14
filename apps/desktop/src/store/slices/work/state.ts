import type { AutoTreeId, SessionId, WorkspaceId } from '@goodboy/types';
import type { AutoTreeView } from '../auto-view/state';

export const WORK_FILTERS = ['open', 'needsYou', 'working', 'finished'] as const;

export type WorkFilter = (typeof WORK_FILTERS)[number];

export type WorkLead = Readonly<{
  treeId: AutoTreeId;
  sessionId: SessionId;
  sessionGoal: string;
  projectId: string | null;
  branches: ReadonlyArray<string>;
  view: AutoTreeView;
}>;

export type WorkState = {
  readonly workLeads: ReadonlyArray<WorkLead>;
  readonly workFilter: WorkFilter;
  readonly workWorkspaceId: WorkspaceId | null;
  readonly isWorkStale: boolean;
};

export const workInitialState: WorkState = {
  workLeads: [],
  workFilter: 'open',
  workWorkspaceId: null,
  isWorkStale: false,
};
