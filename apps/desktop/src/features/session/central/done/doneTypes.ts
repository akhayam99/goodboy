import type { ReactNode } from 'react';
import type { Agent, AgentId, SessionEvent } from '@goodboy/types';
import type { AutoTreeView } from '../../../../store/slices/auto-view/state';
import type { AutoGroup } from '../../../auto/autoGroupOf';
import type { WorkTimeSource } from '../../../workTreeModel/workTimeSource';
import type {
  TimelineAgentEntry,
  TimelineEventEntry,
  TimelineRunEntry,
  TimelineTopLevelEntry,
} from '../../timeline/buildTimelineGroups';

export type DoneSource = TimelineRunEntry | TimelineAgentEntry | TimelineEventEntry;

export type DoneModel = {
  readonly entries: ReadonlyArray<TimelineTopLevelEntry>;
  readonly events: ReadonlyArray<SessionEvent>;
  readonly autoTrees: ReadonlyArray<AutoTreeView>;
  readonly agents: ReadonlyArray<Agent>;
  readonly checkNameByAgentId: ReadonlyMap<string, string>;
  readonly now: number;
};

export type DoneCosts = {
  readonly byAgentId: ReadonlyMap<string, number>;
  readonly byRunId: ReadonlyMap<string, number>;
};

export type DoneStepLine = {
  readonly id: string;
  readonly title: string;
  readonly role: string;
  readonly model: string | null;
  readonly effort: string | null;
  readonly duration: string | null;
};

export type DoneBranchLine = {
  readonly id: string;
  readonly project: string | null;
  readonly branch: string;
  readonly fact: string;
};

export type DoneDetail = {
  readonly model: string | null;
  readonly effort: string | null;
  readonly duration: string | null;
  readonly costUsd: number | null;
  readonly fullText: string | null;
  readonly steps: ReadonlyArray<DoneStepLine>;
  readonly auto: AutoGroup | null;
  readonly branches: ReadonlyArray<DoneBranchLine>;
};

export type DoneRowModel = {
  readonly id: string;
  readonly entryId: string;
  readonly title: string;
  readonly by: string;
  readonly at: string;
  readonly mountId: string | null;
  readonly retryAgentId: AgentId | null;
  readonly detail: DoneDetail;
};

export type DoneDay = {
  readonly key: string;
  readonly label: string | null;
  readonly rows: ReadonlyArray<DoneRowModel>;
};

export type DoneRowParams = {
  readonly row: DoneRowModel;
};

export type DoneChipFor = (params: DoneRowParams) => ReactNode;
