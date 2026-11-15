export type SpendAgent = Readonly<{
  agentId: string;
  mountId: string | null;
  spendUsd: number;
}>;

export type BranchSpend = Readonly<{
  mountId: string | null;
  spendUsd: number;
}>;

type Params = {
  readonly agents: ReadonlyArray<SpendAgent>;
  readonly leadSpendUsd: number;
  readonly primaryMountId: string | null;
};

export const leadSpendByBranchOf = ({
  agents,
  leadSpendUsd,
  primaryMountId,
}: Params): ReadonlyArray<BranchSpend> => {
  const byMount = new Map<string | null, number>();
  const seen = new Set<string>();
  const add = ({ mountId, spendUsd }: BranchSpend): void => {
    byMount.set(mountId, (byMount.get(mountId) ?? 0) + spendUsd);
  };
  for (const agent of agents) {
    if (seen.has(agent.agentId)) {
      continue;
    }
    seen.add(agent.agentId);
    add({ mountId: agent.mountId, spendUsd: agent.spendUsd });
  }
  add({ mountId: primaryMountId, spendUsd: leadSpendUsd });
  return [...byMount.entries()]
    .filter(([, spendUsd]) => spendUsd !== 0)
    .map(([mountId, spendUsd]) => ({ mountId, spendUsd }));
};
