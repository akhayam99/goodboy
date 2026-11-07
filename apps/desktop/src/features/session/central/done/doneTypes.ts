import type { Agent, AgentId, SessionEvent } from '@goodboy/types';
import type { AutoTreeView } from '../../../../store/slices/auto-view/state';
import type { AgentKind } from '../../agent-kind';
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

export type DoneRowModel = {
  readonly id: string;
  readonly entryId: string;
  readonly title: string;
  readonly by: string;
  readonly kind: AgentKind | null;
  readonly leadAgentId: AgentId | null;
  readonly at: string;
  readonly agentIds: ReadonlyArray<AgentId>;
};

export type DoneDay = {
  readonly key: string;
  readonly label: string | null;
  readonly rows: ReadonlyArray<DoneRowModel>;
};

type DoneRowParams = {
  readonly row: DoneRowModel;
};
