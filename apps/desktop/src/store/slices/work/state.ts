import type { AutoTreeId, ProjectId, SessionId, WorkspaceId } from '@goodboy/types';
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

export type StartWorkSeed = Readonly<{
  sessionId: SessionId | null;
  projectId: ProjectId | null;
  branch: string | null;
  text: string;
}>;

export type WorkState = {
  readonly workLeads: ReadonlyArray<WorkLead>;
  readonly workFilter: WorkFilter;
  readonly workWorkspaceId: WorkspaceId | null;
  readonly isWorkStale: boolean;
  readonly workStart: StartWorkSeed | null;
};

export const workInitialState: WorkState = {
  workLeads: [],
  workFilter: 'open',
  workWorkspaceId: null,
  isWorkStale: false,
  workStart: null,
};
