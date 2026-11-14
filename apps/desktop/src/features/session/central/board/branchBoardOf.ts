import type { Session } from '@goodboy/types';
import { deriveSessionStage } from '../../../../store/slices/session-view/deriveSessionStage';
import { leadSpendByBranchOf } from '../../../auto/tree/leadSpendByBranchOf';
import type { BranchFacts } from '../branches/branchFactsOf';
import { branchFactsFor } from './branchFactsFor';
import type {
  BoardAgent,
  BoardAsk,
  BoardGroup,
  BoardGroupId,
  BoardLead,
  BoardRow,
  BranchBoard,
} from './boardTypes';

export const MERGED_FOLD_LIMIT = 3;

export const NO_BRANCH_ROW_ID = 'no-branch';

const GROUP_ORDER: ReadonlyArray<BoardGroupId> = [
  'needs-you',
  'in-progress',
  'merged',
  'not-on-branch',
];

const GROUP_LABEL: Record<BoardGroupId, string> = {
  'needs-you': 'Needs you',
  'in-progress': 'In progress',
  merged: 'Merged',
  'not-on-branch': 'Not on a branch',
};

type Params = {
  readonly session: Session;
  readonly branches: ReadonlyArray<BranchFacts>;
  readonly asks: ReadonlyArray<BoardAsk>;
  readonly agents: ReadonlyArray<BoardAgent>;
  readonly leads: ReadonlyArray<BoardLead>;
  readonly recencyByMountId?: ReadonlyMap<string, number>;
};

type UniqueParams<Item extends { readonly id: string }> = {
  readonly items: ReadonlyArray<Item>;
};

const uniqueById = <Item extends { readonly id: string }>({
  items,
}: UniqueParams<Item>): ReadonlyArray<Item> => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
};

type OwnerParams = {
  readonly mountId: string | null;
  readonly knownMountIds: ReadonlySet<string>;
};

const ownerOf = ({ mountId, knownMountIds }: OwnerParams): string | null =>
  mountId !== null && knownMountIds.has(mountId) ? mountId : null;

type GroupParams = {
  readonly isMerged: boolean;
  readonly isBranchless: boolean;
  readonly isAttention: boolean;
};

const boardGroupIdOf = ({ isMerged, isBranchless, isAttention }: GroupParams): BoardGroupId => {
  if (isBranchless) {
    return 'not-on-branch';
  }
  if (isMerged) {
    return 'merged';
  }
  return isAttention ? 'needs-you' : 'in-progress';
};

type RowParams = {
  readonly session: Session;
  readonly branch: BranchFacts | null;
  readonly asks: ReadonlyArray<BoardAsk>;
  readonly agents: ReadonlyArray<BoardAgent>;
  readonly leads: ReadonlyArray<BoardLead>;
  readonly spendUsd: number;
  readonly elapsedMs: number;
};

const rowOf = ({
  session,
  branch,
  asks,
  agents,
  leads,
  spendUsd,
  elapsedMs,
}: RowParams): BoardRow => {
  const stage = deriveSessionStage(branchFactsFor({ session, branch, asks, agents }));
  const isMerged = branch !== null && (branch.isFinished || stage.prState === 'merged');
  const askIds = asks.map((ask) => ask.id);
  const attentionId =
    stage.attention !== null && stage.attention !== 'open-question'
      ? [`${branch?.mountId ?? NO_BRANCH_ROW_ID}:${stage.attention}`]
      : [];
  const leadIds = new Set<string>(leads.map((lead) => lead.id));
  for (const agent of agents) {
    if (agent.leadId !== null) {
      leadIds.add(agent.leadId);
    }
  }
  for (const ask of asks) {
    if (ask.leadId !== null) {
      leadIds.add(ask.leadId);
    }
  }
  const request = branch?.request ?? null;
  return {
    id: branch?.mountId ?? NO_BRANCH_ROW_ID,
    mountId: branch?.mountId ?? null,
    projectName: branch?.projectName ?? null,
    branch: branch?.branch ?? null,
    group: boardGroupIdOf({
      isMerged,
      isBranchless: branch === null,
      isAttention: stage.stage === 'attention' && !isMerged,
    }),
    isMerged,
    stage,
    checks: request === null || isMerged ? null : request.checks,
    askIds,
    agentIds: agents.map((agent) => agent.id),
    leadIds: [...leadIds],
    needsYouIds: isMerged ? [] : [...askIds, ...attentionId],
    spendUsd,
    elapsedMs,
  };
};

type SplitParams = {
  readonly agents: ReadonlyArray<BoardAgent>;
  readonly leads: ReadonlyArray<BoardLead>;
  readonly knownMountIds: ReadonlySet<string>;
};

const spendByMountOf = ({
  agents,
  leads,
  knownMountIds,
}: SplitParams): ReadonlyMap<string | null, number> => {
  const byMount = new Map<string | null, number>();
  const leadIds = new Set(leads.map((lead) => lead.id));
  const groups: Array<{
    readonly lead: BoardLead | null;
    readonly agents: ReadonlyArray<BoardAgent>;
  }> = leads.map((lead) => ({
    lead,
    agents: agents.filter((agent) => agent.leadId === lead.id),
  }));
  groups.push({
    lead: null,
    agents: agents.filter((agent) => agent.leadId === null || !leadIds.has(agent.leadId)),
  });
  for (const group of groups) {
    const split = leadSpendByBranchOf({
      agents: group.agents.map((agent) => ({
        agentId: agent.id,
        mountId: agent.mountId,
        spendUsd: agent.spendUsd,
      })),
      leadSpendUsd: group.lead?.spendUsd ?? 0,
      primaryMountId: group.lead?.primaryMountId ?? null,
    });
    for (const { mountId, spendUsd } of split) {
      const key = ownerOf({ mountId, knownMountIds });
      byMount.set(key, (byMount.get(key) ?? 0) + spendUsd);
    }
  }
  return byMount;
};

const elapsedByMountOf = ({
  agents,
  leads,
  knownMountIds,
}: SplitParams): ReadonlyMap<string | null, number> => {
  const byMount = new Map<string | null, number>();
  const entries = [
    ...agents.map((agent) => ({ mountId: agent.mountId, elapsedMs: agent.elapsedMs })),
    ...leads.map((lead) => ({ mountId: lead.primaryMountId, elapsedMs: lead.elapsedMs })),
  ];
  for (const { mountId, elapsedMs } of entries) {
    const key = ownerOf({ mountId, knownMountIds });
    byMount.set(key, (byMount.get(key) ?? 0) + elapsedMs);
  }
  return byMount;
};

type NewestParams = {
  readonly rows: ReadonlyArray<BoardRow>;
  readonly recencyByMountId: ReadonlyMap<string, number>;
};

const newestFirst = ({ rows, recencyByMountId }: NewestParams): ReadonlyArray<BoardRow> =>
  [...rows].sort((left, right) => {
    const leftAt = recencyByMountId.get(left.id) ?? 0;
    const rightAt = recencyByMountId.get(right.id) ?? 0;
    return rightAt - leftAt || (left.branch ?? '').localeCompare(right.branch ?? '');
  });

type GroupsParams = {
  readonly rows: ReadonlyArray<BoardRow>;
  readonly recencyByMountId: ReadonlyMap<string, number>;
};

const boardGroupsOf = ({ rows, recencyByMountId }: GroupsParams): ReadonlyArray<BoardGroup> => {
  const hasOtherBranchGroup = rows.some(
    (row) => row.group !== 'merged' && row.group !== 'not-on-branch',
  );
  return GROUP_ORDER.flatMap((id): ReadonlyArray<BoardGroup> => {
    const members = rows.filter((row) => row.group === id);
    if (members.length === 0) {
      return [];
    }
    const ordered = id === 'merged' ? newestFirst({ rows: members, recencyByMountId }) : members;
    const rowIds = ordered.map((row) => row.id);
    const isFolded = id === 'merged' && hasOtherBranchGroup && rowIds.length > MERGED_FOLD_LIMIT;
    const visibleRowIds = isFolded ? rowIds.slice(0, MERGED_FOLD_LIMIT) : rowIds;
    return [
      {
        id,
        label: GROUP_LABEL[id],
        rowIds,
        visibleRowIds,
        hiddenCount: rowIds.length - visibleRowIds.length,
      },
    ];
  });
};

export const branchBoardOf = ({
  session,
  branches,
  asks,
  agents,
  leads,
  recencyByMountId = new Map(),
}: Params): BranchBoard => {
  const uniqueBranches = [...new Map(branches.map((branch) => [branch.mountId, branch])).values()];
  const knownMountIds = new Set<string>(uniqueBranches.map((branch) => branch.mountId));
  const uniqueAgents = uniqueById({ items: agents });
  const uniqueAsks = uniqueById({ items: asks });
  const uniqueLeads = uniqueById({ items: leads });
  const split = { agents: uniqueAgents, leads: uniqueLeads, knownMountIds };
  const spendByMount = spendByMountOf(split);
  const elapsedByMount = elapsedByMountOf(split);
  const branchRows = uniqueBranches.map((branch) =>
    rowOf({
      session,
      branch,
      asks: uniqueAsks.filter((ask) => ask.mountId === branch.mountId),
      agents: uniqueAgents.filter((agent) => agent.mountId === branch.mountId),
      leads: uniqueLeads.filter((lead) => lead.primaryMountId === branch.mountId),
      spendUsd: spendByMount.get(branch.mountId) ?? 0,
      elapsedMs: elapsedByMount.get(branch.mountId) ?? 0,
    }),
  );
  const looseAsks = uniqueAsks.filter(
    (ask) => ownerOf({ mountId: ask.mountId, knownMountIds }) === null,
  );
  const looseAgents = uniqueAgents.filter(
    (agent) => ownerOf({ mountId: agent.mountId, knownMountIds }) === null,
  );
  const looseLeads = uniqueLeads.filter(
    (lead) => ownerOf({ mountId: lead.primaryMountId, knownMountIds }) === null,
  );
  const loneSpend = spendByMount.get(null) ?? 0;
  const hasLooseWork =
    looseAsks.length > 0 || looseAgents.length > 0 || looseLeads.length > 0 || loneSpend !== 0;
  const looseRows =
    hasLooseWork || branchRows.length === 0
      ? [
          rowOf({
            session,
            branch: null,
            asks: looseAsks,
            agents: looseAgents,
            leads: looseLeads,
            spendUsd: loneSpend,
            elapsedMs: elapsedByMount.get(null) ?? 0,
          }),
        ]
      : [];
  const rows = [...branchRows, ...looseRows];
  const isAlone = branchRows.length === 1 && looseRows.length === 0;
  return {
    rows,
    groups: boardGroupsOf({ rows, recencyByMountId }),
    isGrouped: !isAlone,
    isAlone,
  };
};
