import type { ProjectId, SessionId, WorkspaceId } from '@goodboy/types';

export type { GetFn } from '../../slice-types';

type TrackerMoveProvider = 'linear' | 'jira';

type TrackerMoveTarget =
  | Readonly<{ kind: 'linear'; stateId: string; fromStateId: string }>
  | Readonly<{ kind: 'jira'; transitionId: string }>;

export type TrackerMove = Readonly<{
  key: string;
  provider: TrackerMoveProvider;
  workspaceId: WorkspaceId;
  projectId: ProjectId | null;
  externalId: string;
  identifier: string;
  title: string;
  fromName: string;
  toName: string;
  target: TrackerMoveTarget;
}>;

export type TrackerRead =
  | Readonly<{ kind: 'open'; move: TrackerMove }>
  | Readonly<{ kind: 'done' }>
  | Readonly<{ kind: 'unknown' }>;

export type CheckTrackerMovesParams = Readonly<{
  sessionId: SessionId;
}>;

export type MoveTrackerItemParams = Readonly<{
  sessionId: SessionId;
  key: string;
}>;

export type MoveTrackerItemResult =
  | Readonly<{ kind: 'moved'; move: TrackerMove }>
  | Readonly<{ kind: 'already-done' }>
  | Readonly<{ kind: 'gone' }>;

export type UndoTrackerMoveParams = Readonly<{
  sessionId: SessionId;
  move: TrackerMove;
}>;
