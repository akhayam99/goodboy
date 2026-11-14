import type { Agent, AgentId, MountId } from '@goodboy/types';
import type { DotState } from '@goodboy/ui';
import type { MountRowView } from '../../store/slices/project-mounts/mountRowModel';
import type { AutoTreeView } from '../../store/slices/auto-view/state';
import { leadSpendByBranchOf } from '../auto/tree/leadSpendByBranchOf';
import { leadTreeDelegationsOf } from '../auto/tree/leadTreeDelegationsOf';
import { leadTreeItemsOf, type LeadTreeItem } from '../auto/tree/leadTreeItemsOf';
import { leadTreeOf } from '../auto/tree/leadTreeOf';
import {
  alsoOnOf,
  branchGroupCountsOf,
  type BranchGroup,
  type BranchGroupPart,
} from './branchGroupsOf';
import type { SessionRun } from './sessionRunsOf';

export type BranchLead = Readonly<{
  id: string;
  agentId: AgentId;
  title: string;
  dot: DotState;
  stateWord: string;
  spendUsd: number;
  alsoOn: ReadonlyArray<Pick<BranchGroupPart, 'mountId' | 'branch'>>;
  items: ReadonlyArray<LeadTreeItem>;
}>;

export type BranchLeads = Readonly<{
  leads: ReadonlyArray<BranchLead>;
  earlier: BranchGroup | null;
}>;

type Params = {
  readonly group: BranchGroup | null;
  readonly mountId: MountId | null;
  readonly mounts: ReadonlyArray<MountRowView>;
  readonly views: ReadonlyArray<AutoTreeView>;
  readonly agents: ReadonlyArray<Agent>;
  readonly spendByAgentId: ReadonlyMap<AgentId, number>;
  readonly openFoldIds: ReadonlySet<string>;
};

type LeadParams = Omit<Params, 'group'> & {
  readonly run: SessionRun;
  readonly agentId: AgentId;
  readonly groupKey: string;
};

type RunParams = {
  readonly run: SessionRun;
};

const leadAgentIdOf = ({ run }: RunParams): AgentId | null =>
  run.kind === 'auto' && run.open.kind === 'auto' ? run.open.agentId : null;

const branchLeadOf = ({
  run,
  agentId,
  groupKey,
  mountId,
  mounts,
  views,
  agents,
  spendByAgentId,
  openFoldIds,
}: LeadParams): BranchLead => {
  const base = {
    id: run.id,
    agentId,
    title: run.title,
    dot: run.dot,
    stateWord: run.stateWord,
    alsoOn: alsoOnOf({ run, groupKey, mounts }).map(({ mountId: other, branch }) => ({
      mountId: other,
      branch,
    })),
  };
  const view = views.find((candidate) => candidate.tree.rootAgentId === base.agentId);
  if (view === undefined || mountId === null) {
    return { ...base, spendUsd: 0, items: [] };
  }
  const facts = leadTreeDelegationsOf({
    delegations: view.delegations,
    agents,
    spendByAgentId,
    leadAgentId: base.agentId,
  });
  const split = leadSpendByBranchOf({
    agents: facts.delegations,
    leadSpendUsd: spendByAgentId.get(base.agentId) ?? 0,
    primaryMountId: view.tree.primaryMountId,
  });
  const here = facts.delegations
    .filter((delegation) => delegation.mountId === mountId)
    .map((delegation) => ({ ...delegation, parentAgentId: base.agentId }));
  const tree = leadTreeOf({
    delegations: here,
    notes: [],
    plans: [],
    leadAgentId: base.agentId,
    leadSpendUsd: 0,
    primaryMountId: null,
    openFoldIds,
  });
  return {
    ...base,
    spendUsd: split.find((entry) => entry.mountId === mountId)?.spendUsd ?? 0,
    items: leadTreeItemsOf({ tree, agentsById: facts.agentsById, notes: [] }),
  };
};

export const branchLeadsOf = ({ group, ...rest }: Params): BranchLeads => {
  if (group === null) {
    return { leads: [], earlier: null };
  }
  const leadRuns = group.runs.flatMap((run) => {
    const agentId = leadAgentIdOf({ run });
    return agentId === null ? [] : [{ run, agentId }];
  });
  if (leadRuns.length === 0) {
    return { leads: [], earlier: group };
  }
  const others = group.runs.filter((run) => leadAgentIdOf({ run }) === null);
  return {
    leads: leadRuns.map(({ run, agentId }) =>
      branchLeadOf({ ...rest, run, agentId, groupKey: group.key }),
    ),
    earlier:
      others.length === 0
        ? null
        : { ...group, runs: others, counts: branchGroupCountsOf({ runs: others }) },
  };
};
