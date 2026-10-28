import { autoTreeLimitOf, type AutoBudgetFacts } from '@goodboy/core';
import { formatUsd } from '@goodboy/ui';
import type { SettingWords } from '../../../../shared/components/SettingChip/settingWords';

type Params = {
  readonly facts: AutoBudgetFacts;
  readonly sessionCapUsd: number | null;
  readonly workspaceLimitUsd: number | null;
  readonly workspaceName: string;
};

type AmountParams = {
  readonly amount: number | null;
};

type SourceParams = {
  readonly cap: number | null;
  readonly sessionCapUsd: number | null;
  readonly workspaceLimitUsd: number | null;
  readonly workspaceName: string;
};

const CENT = 0.005;

const amountOf = ({ amount }: AmountParams): string =>
  amount === null ? 'none' : formatUsd(amount);

const sourceOf = ({ cap, sessionCapUsd, workspaceLimitUsd, workspaceName }: SourceParams) => {
  const inherited = autoTreeLimitOf({ sessionCapUsd, workspaceLimitUsd });
  if (cap === null || inherited.usd === null || Math.abs(cap - inherited.usd) >= CENT) {
    return 'this Auto';
  }
  if (inherited.source === 'session') {
    return 'from session';
  }
  return `from ${workspaceName}`;
};

export const autoLimitWordsOf = ({
  facts,
  sessionCapUsd,
  workspaceLimitUsd,
  workspaceName,
}: Params): SettingWords => {
  const cap = facts.capUsd;
  const workspaceUsd = autoTreeLimitOf({ sessionCapUsd: null, workspaceLimitUsd }).usd;
  const chain = `This Auto ${amountOf({ amount: cap })}, then session ${amountOf({
    amount: sessionCapUsd,
  })}, then ${workspaceName} ${amountOf({ amount: workspaceUsd })}.`;
  const limits = [cap, sessionCapUsd].filter(
    (limit): limit is number => limit !== null && limit > 0,
  );
  if (limits.length === 0) {
    return {
      value: facts.spentUsd < CENT ? 'none' : `${formatUsd(facts.spentUsd)} spent`,
      source: '',
      chain: `${chain} Nothing stops this Auto.`,
    };
  }
  const first = Math.min(...limits);
  return {
    value: `${formatUsd(facts.spentUsd)} of ${formatUsd(first)}`,
    source: sourceOf({ cap, sessionCapUsd, workspaceLimitUsd, workspaceName }),
    chain: `${chain} ${formatUsd(first)} comes first.`,
  };
};
