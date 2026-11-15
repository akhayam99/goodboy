import {
  brandId,
  type Agent,
  type IsoDateTime,
  type SessionEvent,
  type SessionEventId,
  type SessionEventPayload,
  type SessionId,
  type Workflow,
  type WorkflowRun,
} from '@goodboy/types';
import type { AutoTreeView } from '../../../../../store/slices/auto-view/state';
import {
  buildTimelineGroups,
  type TimelineTopLevelEntry,
} from '../../../timeline/buildTimelineGroups';

type DoneModel = {
  readonly entries: ReadonlyArray<TimelineTopLevelEntry>;
  readonly events: ReadonlyArray<SessionEvent>;
  readonly autoTrees: ReadonlyArray<AutoTreeView>;
  readonly agents: ReadonlyArray<Agent>;
  readonly checkNameByAgentId: ReadonlyMap<string, string>;
  readonly now: number;
};

export const SESSION_ID = brandId<SessionId>({ value: 'session-harborline' });
export const NOW = new Date(2026, 9, 18, 12, 0);

type AtParams = {
  readonly day?: number;
  readonly hour: number;
  readonly minute?: number;
};

export const at = ({ day = 18, hour, minute = 0 }: AtParams): IsoDateTime =>
  brandId<IsoDateTime>({ value: new Date(2026, 9, day, hour, minute).toISOString() });

type EventParams = {
  readonly id: string;
  readonly kind: SessionEvent['kind'];
  readonly payload?: SessionEventPayload;
  readonly createdAt?: IsoDateTime;
};

export const eventOf = ({
  id,
  kind,
  payload = {},
  createdAt = at({ hour: 9, minute: 12 }),
}: EventParams): SessionEvent => ({
  id: brandId<SessionEventId>({ value: id }),
  sessionId: SESSION_ID,
  kind,
  payload,
  createdAt,
});

type WorldParams = {
  readonly agents?: ReadonlyArray<Agent>;
  readonly runs?: ReadonlyArray<{ readonly run: WorkflowRun; readonly workflow: Workflow }>;
  readonly events?: ReadonlyArray<SessionEvent>;
  readonly autoTrees?: ReadonlyArray<AutoTreeView>;
  readonly checkNameByAgentId?: ReadonlyMap<string, string>;
};

export const modelOf = ({
  agents = [],
  runs = [],
  events = [],
  autoTrees = [],
  checkNameByAgentId = new Map(),
}: WorldParams): DoneModel => {
  const { entries } = buildTimelineGroups({
    sessionId: SESSION_ID,
    agents,
    workflows: runs,
    plans: [],
    artifacts: [],
    externalTasks: [],
    questions: [],
    worktrees: [],
    events,
    agentKindOverride: {},
  });
  return {
    entries,
    events,
    autoTrees,
    agents,
    checkNameByAgentId,
    now: NOW.getTime(),
  };
};
