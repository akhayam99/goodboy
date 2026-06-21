import type {
  PlanId,
  Session,
  SessionGroupKey,
  SessionId,
  SessionPrGroup,
  SessionSortKey,
  SessionStage,
  SessionViewPrefs,
  WorkspaceId,
} from '@goodboy/types';

export type { SetFn, GetFn } from '../../slice-types';

export type LensKind =
  | 'questions'
  | 'agents'
  | 'workflows'
  | 'resolve'
  | 'plans'
  | 'scripts'
  | 'terminal'
  | 'goal'
  | 'decisions'
  | 'last_output_summary'
  | 'pr'
  | 'files';

export const LENS_KINDS = new Set<LensKind>([
  'questions',
  'agents',
  'workflows',
  'resolve',
  'plans',
  'scripts',
  'terminal',
  'goal',
  'decisions',
  'last_output_summary',
  'pr',
  'files',
]);

export type SessionStudio =
  | { readonly kind: 'workflow' }
  | { readonly kind: 'github'; readonly prNumber?: number; readonly threadId?: string }
  | { readonly kind: 'mr' };

export const DEFAULT_PREFS: SessionViewPrefs = { sort: 'updatedAt', group: 'stage' };

export const VALID_SORTS = new Set<SessionSortKey>(['updatedAt', 'goal', 'createdAt']);
export const VALID_GROUPS = new Set<SessionGroupKey>(['none', 'stage', 'pr']);

export const STAGE_ORDER: Record<SessionStage, number> = {
  attention: 0,
  running: 1,
  review: 2,
  building: 3,
  done: 4,
};

export const PR_GROUP_ORDER: Record<SessionPrGroup, number> = {
  'not-open': 0,
  draft: 1,
  reviewable: 2,
  reviewed: 3,
  closed: 4,
  merged: 5,
};

export type LensHistory = {
  readonly entries: ReadonlyArray<LensKind | null>;
  readonly index: number;
};

type SessionViewSliceState = {
  readonly sessionViewPrefs: Readonly<Record<WorkspaceId, SessionViewPrefs>>;
  readonly activeLens: Readonly<Record<SessionId, LensKind | null>>;
  readonly lensHistory: Readonly<Record<SessionId, LensHistory>>;
  readonly focusedPlanId: Readonly<Record<SessionId, PlanId | null>>;
  readonly sessionStudio: Readonly<Record<SessionId, SessionStudio | null>>;
  readonly workflowExpand: Readonly<Record<SessionId, Readonly<Record<string, boolean>>>>;
};

type SessionViewSliceActions = {
  getSessionViewPrefs(workspaceId: WorkspaceId): SessionViewPrefs;
  setSessionSort(workspaceId: WorkspaceId, sort: SessionSortKey): void;
  setSessionGroup(workspaceId: WorkspaceId, group: SessionGroupKey): void;
  setActiveLens(sessionId: SessionId, lens: LensKind | null): void;
  lensGo(sessionId: SessionId, delta: number): void;
  toggleWorkflowExpand(sessionId: SessionId, runId: string, defaultExpanded: boolean): void;
  setFocusedPlanId(sessionId: SessionId, planId: PlanId | null): void;
  setSessionStudio(sessionId: SessionId, studio: SessionStudio | null): void;
};

export type SessionViewSlice = SessionViewSliceState & SessionViewSliceActions;

export type GroupedSessions = {
  readonly key: string;
  readonly sessions: ReadonlyArray<Session>;
};
