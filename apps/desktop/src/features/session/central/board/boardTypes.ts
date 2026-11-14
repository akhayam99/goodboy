import type { SessionStageInfo } from '@goodboy/types';

export type BoardAsk = Readonly<{
  id: string;
  mountId: string | null;
  leadId: string | null;
}>;

export type BoardAgent = Readonly<{
  id: string;
  leadId: string | null;
  mountId: string | null;
  spendUsd: number;
  elapsedMs: number;
  isRunning: boolean;
  isBlocked: boolean;
  isFailed: boolean;
}>;

export type BoardLead = Readonly<{
  id: string;
  primaryMountId: string | null;
  spendUsd: number;
  elapsedMs: number;
}>;

export type BoardGroupId = 'needs-you' | 'in-progress' | 'merged' | 'not-on-branch';

export type BoardRow = Readonly<{
  id: string;
  mountId: string | null;
  projectName: string | null;
  branch: string | null;
  group: BoardGroupId;
  isMerged: boolean;
  stage: SessionStageInfo;
  checks: 'success' | 'failure' | 'pending' | null;
  askIds: ReadonlyArray<string>;
  agentIds: ReadonlyArray<string>;
  leadIds: ReadonlyArray<string>;
  needsYouIds: ReadonlyArray<string>;
  spendUsd: number;
  elapsedMs: number;
}>;

export type BoardGroup = Readonly<{
  id: BoardGroupId;
  label: string;
  rowIds: ReadonlyArray<string>;
  visibleRowIds: ReadonlyArray<string>;
  hiddenCount: number;
}>;

export type BranchBoard = Readonly<{
  rows: ReadonlyArray<BoardRow>;
  groups: ReadonlyArray<BoardGroup>;
  isGrouped: boolean;
  isAlone: boolean;
}>;
