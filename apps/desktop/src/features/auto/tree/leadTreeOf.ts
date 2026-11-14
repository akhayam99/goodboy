import { leadSpendByBranchOf, type BranchSpend } from './leadSpendByBranchOf';

export type LeadTreeDelegation = Readonly<{
  id: string;
  agentId: string;
  parentAgentId: string | null;
  retryOfId: string | null;
  role: string;
  createdAt: number;
  isSettled: boolean;
  mountId: string | null;
  spendUsd: number;
}>;

export type LeadTreeTimed = Readonly<{
  id: string;
  createdAt: number;
}>;

export type LeadTreeAttempt = Readonly<{
  delegationId: string;
  agentId: string;
}>;

export type LeadTreeRow =
  | Readonly<{
      kind: 'agent';
      id: string;
      number: string;
      depth: number;
      role: string;
      agentId: string;
      attempts: ReadonlyArray<LeadTreeAttempt>;
      mountId: string | null;
      isSettled: boolean;
      ownSpendUsd: number;
      branchSpendUsd: number;
    }>
  | Readonly<{
      kind: 'fold';
      id: string;
      depth: number;
      count: number;
      role: string | null;
      isOpen: boolean;
      childRowIds: ReadonlyArray<string>;
      spendUsd: number;
    }>
  | Readonly<{
      kind: 'note' | 'plan';
      id: string;
      depth: number;
      createdAt: number;
    }>;

export type LeadTree = Readonly<{
  rows: ReadonlyArray<LeadTreeRow>;
  totalSpendUsd: number;
  spendByBranch: ReadonlyArray<BranchSpend>;
}>;

type Params = {
  readonly delegations: ReadonlyArray<LeadTreeDelegation>;
  readonly notes: ReadonlyArray<LeadTreeTimed>;
  readonly plans: ReadonlyArray<LeadTreeTimed>;
  readonly leadAgentId: string;
  readonly leadSpendUsd: number;
  readonly primaryMountId: string | null;
  readonly openFoldIds: ReadonlySet<string>;
};

type Chain = {
  readonly head: LeadTreeDelegation;
  readonly attempts: ReadonlyArray<LeadTreeDelegation>;
};

type Node = {
  readonly chain: Chain;
  readonly latest: LeadTreeDelegation;
  readonly children: ReadonlyArray<Node>;
  readonly ownSpendUsd: number;
  readonly branchSpendUsd: number;
  readonly isSettled: boolean;
};

type OrderParams = {
  readonly left: LeadTreeDelegation;
  readonly right: LeadTreeDelegation;
};

type DelegationsParams = {
  readonly delegations: ReadonlyArray<LeadTreeDelegation>;
};

type HeadParams = {
  readonly delegation: LeadTreeDelegation;
  readonly byId: ReadonlyMap<string, LeadTreeDelegation>;
};

type NodesParams = {
  readonly chains: ReadonlyArray<Chain>;
  readonly parentAgentIds: ReadonlySet<string>;
  readonly visiting: ReadonlySet<string>;
};

type NodeParams = {
  readonly node: Node;
};

type NodeListParams = {
  readonly nodes: ReadonlyArray<Node>;
};

const launchOrderOf = ({ left, right }: OrderParams): number =>
  left.createdAt - right.createdAt || left.id.localeCompare(right.id);

const uniqueByAgent = ({ delegations }: DelegationsParams): ReadonlyArray<LeadTreeDelegation> => {
  const seen = new Set<string>();
  const unique: LeadTreeDelegation[] = [];
  for (const delegation of [...delegations].sort((left, right) => launchOrderOf({ left, right }))) {
    if (seen.has(delegation.agentId)) {
      continue;
    }
    seen.add(delegation.agentId);
    unique.push(delegation);
  }
  return unique;
};

const chainHeadIdOf = ({ delegation, byId }: HeadParams): string => {
  const visited = new Set<string>([delegation.id]);
  let current = delegation;
  while (current.retryOfId !== null) {
    const previous = byId.get(current.retryOfId);
    if (previous === undefined || visited.has(previous.id)) {
      break;
    }
    visited.add(previous.id);
    current = previous;
  }
  return current.id;
};

const chainsOf = ({ delegations }: DelegationsParams): ReadonlyArray<Chain> => {
  const byId = new Map(delegations.map((delegation) => [delegation.id, delegation]));
  const grouped = new Map<string, LeadTreeDelegation[]>();
  for (const delegation of delegations) {
    const headId = chainHeadIdOf({ delegation, byId });
    grouped.set(headId, [...(grouped.get(headId) ?? []), delegation]);
  }
  const chains: Chain[] = [];
  for (const [headId, attempts] of grouped) {
    const head = byId.get(headId);
    if (head === undefined) {
      continue;
    }
    chains.push({
      head,
      attempts: [...attempts].sort((left, right) => launchOrderOf({ left, right })),
    });
  }
  return chains.sort((left, right) => launchOrderOf({ left: left.head, right: right.head }));
};

const nodesOf = ({ chains, parentAgentIds, visiting }: NodesParams): ReadonlyArray<Node> =>
  chains
    .filter((chain) => {
      const { parentAgentId } = chain.head;
      return parentAgentId !== null && parentAgentIds.has(parentAgentId);
    })
    .filter((chain) => !visiting.has(chain.head.id))
    .map((chain): Node => {
      const latest = chain.attempts[chain.attempts.length - 1] ?? chain.head;
      const inside = new Set(visiting).add(chain.head.id);
      const children = nodesOf({
        chains,
        parentAgentIds: new Set(chain.attempts.map((attempt) => attempt.agentId)),
        visiting: inside,
      });
      const ownSpendUsd = chain.attempts.reduce((sum, attempt) => sum + attempt.spendUsd, 0);
      return {
        chain,
        latest,
        children,
        ownSpendUsd,
        branchSpendUsd: children.reduce((sum, child) => sum + child.branchSpendUsd, ownSpendUsd),
        isSettled: latest.isSettled,
      };
    });

const isNodeDeepSettled = ({ node }: NodeParams): boolean =>
  node.isSettled && node.children.every((child) => isNodeDeepSettled({ node: child }));

const sharedRoleOf = ({ nodes }: NodeListParams): string | null => {
  const [first] = nodes;
  if (first === undefined) {
    return null;
  }
  return nodes.every((node) => node.latest.role === first.latest.role) ? first.latest.role : null;
};

type EmitParams = {
  readonly nodes: ReadonlyArray<Node>;
  readonly prefix: string;
  readonly parentKey: string;
  readonly depth: number;
  readonly openFoldIds: ReadonlySet<string>;
  readonly rows: LeadTreeRow[];
};

const emitNodes = ({ nodes, prefix, parentKey, depth, openFoldIds, rows }: EmitParams): void => {
  const isFoldable = nodes.length > 1 && nodes.every((node) => isNodeDeepSettled({ node }));
  const foldId = `fold:${parentKey}`;
  const isOpen = openFoldIds.has(foldId);
  if (isFoldable) {
    rows.push({
      kind: 'fold',
      id: foldId,
      depth,
      count: nodes.length,
      role: sharedRoleOf({ nodes }),
      isOpen,
      childRowIds: nodes.map((node) => node.latest.id),
      spendUsd: nodes.reduce((sum, node) => sum + node.branchSpendUsd, 0),
    });
    if (!isOpen) {
      return;
    }
  }
  nodes.forEach((node, index) => {
    const number = prefix === '' ? `${index + 1}` : `${prefix}.${index + 1}`;
    rows.push({
      kind: 'agent',
      id: node.latest.id,
      number,
      depth: isFoldable ? depth + 1 : depth,
      role: node.latest.role,
      agentId: node.latest.agentId,
      attempts: node.chain.attempts.map((attempt) => ({
        delegationId: attempt.id,
        agentId: attempt.agentId,
      })),
      mountId: node.latest.mountId ?? node.chain.head.mountId,
      isSettled: node.isSettled,
      ownSpendUsd: node.ownSpendUsd,
      branchSpendUsd: node.branchSpendUsd,
    });
    emitNodes({
      nodes: node.children,
      prefix: number,
      parentKey: node.latest.id,
      depth: (isFoldable ? depth + 1 : depth) + 1,
      openFoldIds,
      rows,
    });
  });
};

const KIND_ORDER = { agent: 0, note: 1, plan: 2 } as const;

type Placed = {
  readonly at: number;
  readonly kind: keyof typeof KIND_ORDER;
  readonly rows: ReadonlyArray<LeadTreeRow>;
  readonly id: string;
};

export const leadTreeOf = ({
  delegations,
  notes,
  plans,
  leadAgentId,
  leadSpendUsd,
  primaryMountId,
  openFoldIds,
}: Params): LeadTree => {
  const unique = uniqueByAgent({ delegations });
  const chains = chainsOf({ delegations: unique });
  const topNodes = nodesOf({
    chains,
    parentAgentIds: new Set([leadAgentId]),
    visiting: new Set(),
  });
  const agentRows: LeadTreeRow[] = [];
  emitNodes({
    nodes: topNodes,
    prefix: '',
    parentKey: leadAgentId,
    depth: 0,
    openFoldIds,
    rows: agentRows,
  });
  const isTopFolded = agentRows[0]?.kind === 'fold';
  const placed: Placed[] = [];
  if (isTopFolded) {
    const [fold, ...rest] = agentRows;
    const first = topNodes[0];
    if (fold !== undefined && first !== undefined) {
      placed.push({
        at: first.chain.head.createdAt,
        kind: 'agent',
        rows: [fold, ...rest],
        id: fold.id,
      });
    }
  }
  if (!isTopFolded) {
    let cursor = 0;
    for (const node of topNodes) {
      const start = cursor;
      cursor += 1;
      while (cursor < agentRows.length && (agentRows[cursor]?.depth ?? 0) > 0) {
        cursor += 1;
      }
      placed.push({
        at: node.chain.head.createdAt,
        kind: 'agent',
        rows: agentRows.slice(start, cursor),
        id: node.latest.id,
      });
    }
  }
  for (const note of notes) {
    placed.push({
      at: note.createdAt,
      kind: 'note',
      rows: [{ kind: 'note', id: note.id, depth: 0, createdAt: note.createdAt }],
      id: note.id,
    });
  }
  for (const plan of plans) {
    placed.push({
      at: plan.createdAt,
      kind: 'plan',
      rows: [{ kind: 'plan', id: plan.id, depth: 0, createdAt: plan.createdAt }],
      id: plan.id,
    });
  }
  placed.sort(
    (left, right) =>
      left.at - right.at ||
      KIND_ORDER[left.kind] - KIND_ORDER[right.kind] ||
      left.id.localeCompare(right.id),
  );
  const spendAgents = unique.map((delegation) => ({
    agentId: delegation.agentId,
    mountId: delegation.mountId,
    spendUsd: delegation.spendUsd,
  }));
  return {
    rows: placed.flatMap((entry) => entry.rows),
    totalSpendUsd: unique.reduce((sum, delegation) => sum + delegation.spendUsd, leadSpendUsd),
    spendByBranch: leadSpendByBranchOf({ agents: spendAgents, leadSpendUsd, primaryMountId }),
  };
};
