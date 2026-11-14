import type { LeadStopState } from '@goodboy/core/auto';
import type { AgentId, AutoTreeId, SessionId, TurnState } from '@goodboy/types';
import { leadAsksOf } from '../../store/runtime/auto/asks/leadAsksOf';
import type { WorkFilter, WorkLead } from '../../store/slices/work/state';
import { autoTreeWordOf } from '../auto/autoTreeWordOf';

export type WorkRow = Readonly<{
  treeId: AutoTreeId;
  rootAgentId: AgentId;
  sessionId: SessionId;
  sessionGoal: string;
  projectId: string | null;
  title: string;
  branches: ReadonlyArray<string>;
  lead: LeadStopState;
  askCount: number;
  agentsRunning: number;
  spentUsd: number;
  updatedAt: number;
}>;

export type WorkCounts = Readonly<Record<WorkFilter, number>>;

export type WorkRows = Readonly<{
  rows: ReadonlyArray<WorkRow>;
  counts: WorkCounts;
}>;

type Params = {
  readonly leads: ReadonlyArray<WorkLead>;
  readonly rootTurns: Readonly<Record<string, TurnState | undefined>>;
  readonly filter: WorkFilter;
  readonly isWork: boolean;
};

type RowParams = {
  readonly lead: WorkLead;
  readonly rootTurns: Params['rootTurns'];
  readonly isWork: boolean;
};

const RUNNING_DELEGATION_STATES: ReadonlySet<string> = new Set(['starting', 'running']);

const rowOf = ({ lead, rootTurns, isWork }: RowParams): WorkRow => {
  const { view } = lead;
  const word = autoTreeWordOf({
    view,
    rootTurn: rootTurns[view.tree.rootAgentId] ?? null,
    isWork,
  });
  const rootAsk = view.rootAsk?.trim() ?? '';
  return {
    treeId: lead.treeId,
    rootAgentId: view.tree.rootAgentId,
    sessionId: lead.sessionId,
    sessionGoal: lead.sessionGoal,
    projectId: lead.projectId,
    title: rootAsk.length > 0 ? rootAsk : lead.sessionGoal,
    branches: lead.branches,
    lead: word.lead,
    askCount: leadAsksOf({ view }).length,
    agentsRunning: view.delegations.filter(
      (delegation) =>
        delegation.generation === view.tree.generation &&
        RUNNING_DELEGATION_STATES.has(delegation.state),
    ).length,
    spentUsd: view.budget?.spentUsd ?? 0,
    updatedAt: view.tree.updatedAt,
  };
};

type MatchParams = {
  readonly row: WorkRow;
};

type Match = (params: MatchParams) => boolean;

const isOpenLead: Match = ({ row }) => row.lead.stop !== 'finished' && row.lead.stop !== 'stopped';

const MATCHES = {
  open: isOpenLead,
  needsYou: ({ row }) =>
    isOpenLead({ row }) && (row.lead.stop === 'waitsForYou' || row.askCount > 0),
  working: ({ row }) => row.lead.stop === 'working',
  finished: ({ row }) => row.lead.stop === 'finished',
} as const satisfies Readonly<Record<WorkFilter, Match>>;

type CountParams = {
  readonly rows: ReadonlyArray<WorkRow>;
  readonly filter: WorkFilter;
};

const rowCountOf = ({ rows, filter }: CountParams): number =>
  rows.filter((row) => MATCHES[filter]({ row })).length;

export const workRowsOf = ({ leads, rootTurns, filter, isWork }: Params): WorkRows => {
  const all = leads
    .map((lead) => rowOf({ lead, rootTurns, isWork }))
    .sort((a, b) => b.updatedAt - a.updatedAt || a.treeId.localeCompare(b.treeId));
  return {
    rows: all.filter((row) => MATCHES[filter]({ row })),
    counts: {
      open: rowCountOf({ rows: all, filter: 'open' }),
      needsYou: rowCountOf({ rows: all, filter: 'needsYou' }),
      working: rowCountOf({ rows: all, filter: 'working' }),
      finished: rowCountOf({ rows: all, filter: 'finished' }),
    },
  };
};
