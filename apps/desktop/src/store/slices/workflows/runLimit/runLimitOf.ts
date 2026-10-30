import type { WorkflowRules } from '@goodboy/types';

export type WorkflowLimitSource = NonNullable<WorkflowRules['limitSource']>;

type Params = {
  readonly rules: WorkflowRules;
  readonly spendLimitUsd: number | null | undefined;
  readonly limitSource: WorkflowLimitSource | undefined;
};

export type RunLimit = Readonly<{
  usd: number | null;
  mode: WorkflowRules['spendLimitMode'];
  source: WorkflowLimitSource | null;
}>;

type UsableParams = {
  readonly usd: number | null | undefined;
};

const usableOf = ({ usd }: UsableParams): number | null =>
  usd != null && Number.isFinite(usd) && usd > 0 ? usd : null;

export const runLimitOf = ({ rules, spendLimitUsd, limitSource }: Params): RunLimit => {
  const mode = rules.spendLimitMode;
  if (spendLimitUsd === undefined) {
    const usd = usableOf({ usd: rules.spendLimitUsd });
    return { usd, mode, source: usd === null ? null : 'default' };
  }
  const usd = usableOf({ usd: spendLimitUsd });
  return { usd, mode, source: usd === null ? null : (limitSource ?? 'run') };
};

type SnapshotParams = {
  readonly rules: WorkflowRules;
  readonly limit: RunLimit;
};

export const rulesWithLimit = ({ rules, limit }: SnapshotParams): WorkflowRules => {
  const { limitSource: _previous, ...rest } = rules;
  return {
    ...rest,
    spendLimitUsd: limit.usd,
    spendLimitMode: limit.mode,
    ...(limit.source !== null && { limitSource: limit.source }),
  };
};
