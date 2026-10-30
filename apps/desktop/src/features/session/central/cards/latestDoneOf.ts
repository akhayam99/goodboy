import type { Agent } from '@goodboy/types';
import type { DoneDay, DoneRowModel } from '../done/doneTypes';
import { AGENT_KIND_META, classifyAgent } from '../../agent-kind';
import { plainTitleOf } from '../done/plainTitleOf';

const LATEST_DONE_LIMIT = 3;

const EPOCH = new Date(0).toISOString();

type LatestDoneRowFacts = Pick<
  DoneRowModel,
  'id' | 'entryId' | 'title' | 'by' | 'kind' | 'leadAgentId' | 'at' | 'agentIds'
>;

type LatestDoneItem = Readonly<{
  row: DoneRowModel;
  isUnread: boolean;
}>;

export type NewSinceItem = Readonly<{
  row: LatestDoneRowFacts;
  isUnread: boolean;
}>;

export type LatestDone = Readonly<{
  items: ReadonlyArray<LatestDoneItem>;
  unreadItems: ReadonlyArray<NewSinceItem>;
  unreadCount: number;
}>;

type Params = {
  readonly days: ReadonlyArray<DoneDay>;
  readonly unreadAgents: ReadonlyArray<Agent>;
};

type RowParams = {
  readonly row: DoneRowModel;
  readonly unreadAgentIds: ReadonlySet<string>;
};

type AgentParams = {
  readonly agent: Agent;
};

const isRowUnread = ({ row, unreadAgentIds }: RowParams): boolean =>
  row.agentIds.some((agentId) => unreadAgentIds.has(agentId));

const unlistedItemOf = ({ agent }: AgentParams): NewSinceItem => {
  const entryId = `agent:${agent.id}`;
  const kind = classifyAgent({ agent, override: null });
  return {
    row: {
      id: entryId,
      entryId,
      title: plainTitleOf({ text: agent.outputSummary }) ?? agent.name,
      by: AGENT_KIND_META[kind].noun,
      kind,
      leadAgentId: agent.id,
      at: agent.lastFinishedAt ?? agent.completedAt ?? agent.startedAt ?? EPOCH,
      agentIds: [agent.id],
    },
    isUnread: true,
  };
};

export const latestDoneOf = ({ days, unreadAgents }: Params): LatestDone => {
  const unreadAgentIds = new Set<string>(unreadAgents.map((agent) => agent.id));
  const rows = days.flatMap((day) => day.rows);
  const marked = rows.map((row): LatestDoneItem => ({
    row,
    isUnread: isRowUnread({ row, unreadAgentIds }),
  }));
  const listedAgentIds = new Set<string>(rows.flatMap((row) => row.agentIds));
  const unlisted = unreadAgents
    .filter((agent) => !listedAgentIds.has(agent.id))
    .map((agent) => unlistedItemOf({ agent }));
  const listed = marked.filter((item) => item.isUnread);
  return {
    items: marked.slice(0, LATEST_DONE_LIMIT),
    unreadItems: [...listed, ...unlisted].sort(
      (first, second) => Date.parse(second.row.at) - Date.parse(first.row.at),
    ),
    unreadCount: unreadAgentIds.size,
  };
};
