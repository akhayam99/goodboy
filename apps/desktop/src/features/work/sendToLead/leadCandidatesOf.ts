import type { AgentId, AutoTreeId, SessionId } from '@goodboy/types';
import { leadStopWordOf } from '../../session/leadStopWordOf';
import type { WorkRow } from '../workRowsOf';
import { SEND_TO_LEAD_COPY } from './sendToLeadCopy';

export type LeadItem = Readonly<{
  sessionId: SessionId;
  projectId: string | null;
  branch: string | null;
  holderAgentId: AgentId | null;
  holdReason: string;
}>;

export const LEAD_RULES = ['holds', 'branch', 'session', 'project'] as const;

export type LeadRule = (typeof LEAD_RULES)[number];

export type LeadCandidate = Readonly<{
  treeId: AutoTreeId;
  rootAgentId: AgentId;
  sessionId: SessionId;
  title: string;
  stateWord: string;
  reason: string;
  rule: LeadRule;
}>;

export type LeadChoice =
  | Readonly<{ kind: 'one'; candidate: LeadCandidate }>
  | Readonly<{ kind: 'pick'; candidates: ReadonlyArray<LeadCandidate> }>
  | Readonly<{ kind: 'none' }>;

export const MAX_LEAD_ROWS = 3;

type Params = {
  readonly rows: ReadonlyArray<WorkRow>;
  readonly item: LeadItem;
};

type RowParams = {
  readonly row: WorkRow;
  readonly item: LeadItem;
};

const isOpen = ({ row }: Pick<RowParams, 'row'>): boolean =>
  row.lead.stop !== 'finished' && row.lead.stop !== 'stopped';

const isInProject = ({ row, item }: RowParams): boolean =>
  item.projectId === null
    ? row.sessionId === item.sessionId
    : row.projectId === item.projectId || row.projectIds.includes(item.projectId);

const ruleOf = ({ row, item }: RowParams): LeadRule => {
  if (item.holderAgentId !== null && row.rootAgentId === item.holderAgentId) {
    return 'holds';
  }
  if (
    item.branch !== null &&
    row.places.some(
      (place) =>
        place.branch === item.branch &&
        (item.projectId === null || place.projectId === item.projectId),
    )
  ) {
    return 'branch';
  }
  if (row.sessionId === item.sessionId) {
    return 'session';
  }
  return 'project';
};

type ReasonParams = {
  readonly rule: LeadRule;
  readonly item: LeadItem;
};

const reasonOf = ({ rule, item }: ReasonParams): string => {
  switch (rule) {
    case 'holds':
      return item.holdReason;
    case 'branch':
      return item.branch === null
        ? SEND_TO_LEAD_COPY.sameProject
        : SEND_TO_LEAD_COPY.onBranch({ branch: item.branch });
    case 'session':
      return SEND_TO_LEAD_COPY.sameSession;
    case 'project':
      return SEND_TO_LEAD_COPY.sameProject;
    default: {
      const exhaustive: never = rule;
      return exhaustive;
    }
  }
};

type Ranked = {
  readonly row: WorkRow;
  readonly rule: LeadRule;
};

type CandidateParams = Ranked & {
  readonly item: LeadItem;
};

const candidateOf = ({ row, rule, item }: CandidateParams): LeadCandidate => ({
  treeId: row.treeId,
  rootAgentId: row.rootAgentId,
  sessionId: row.sessionId,
  title: row.sessionGoal,
  stateWord: leadStopWordOf({ lead: row.lead }),
  reason: reasonOf({ rule, item }),
  rule,
});

export const leadCandidatesOf = ({ rows, item }: Params): LeadChoice => {
  const ranked = rows
    .filter((row) => isOpen({ row }) && isInProject({ row, item }))
    .map((row): Ranked => ({ row, rule: ruleOf({ row, item }) }))
    .sort((left, right) => {
      const byRule = LEAD_RULES.indexOf(left.rule) - LEAD_RULES.indexOf(right.rule);
      if (byRule !== 0) {
        return byRule;
      }
      const byUpdate = right.row.updatedAt - left.row.updatedAt;
      return byUpdate !== 0 ? byUpdate : left.row.treeId.localeCompare(right.row.treeId);
    })
    .map(({ row, rule }) => candidateOf({ row, rule, item }));
  const [first] = ranked;
  if (first === undefined) {
    return { kind: 'none' };
  }
  if (ranked.length === 1 || first.rule === 'holds') {
    return { kind: 'one', candidate: first };
  }
  return { kind: 'pick', candidates: ranked.slice(0, MAX_LEAD_ROWS) };
};
