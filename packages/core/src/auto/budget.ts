import type { AutoTreeSpend } from '@goodboy/db';

export type AutoBudgetFacts = Readonly<{
  capUsd: number;
  spentUsd: number;
  reservedUsd: number;
  remainingUsd: number;
  hasEstimate: boolean;
}>;

type RoundUsdParams = {
  readonly usd: number;
};

const roundUsd = ({ usd }: RoundUsdParams): number => Math.round(usd * 100) / 100;

type BudgetOfParams = {
  readonly spend: AutoTreeSpend;
};

export const autoBudgetOf = ({ spend }: BudgetOfParams): AutoBudgetFacts => ({
  capUsd: roundUsd({ usd: spend.capUsd }),
  spentUsd: roundUsd({ usd: spend.settledUsd }),
  reservedUsd: roundUsd({ usd: spend.reservedUsd }),
  remainingUsd: Math.max(0, roundUsd({ usd: spend.remainingUsd })),
  hasEstimate: spend.estimatedUsd > 0,
});

type FactsParams = {
  readonly facts: AutoBudgetFacts;
};

const usdText = ({ usd }: RoundUsdParams): string => `${usd.toFixed(2)} USD`;

const dollarText = ({ usd }: RoundUsdParams): string => `$${usd.toFixed(2)}`;

export const autoBudgetUsedUsd = ({ facts }: FactsParams): number =>
  roundUsd({ usd: facts.spentUsd + facts.reservedUsd });

export const capTextOf = ({ facts }: FactsParams): string =>
  `Limit ${dollarText({ usd: facts.capUsd })}`;

export const autoBudgetLabel = ({ facts }: FactsParams): string => {
  const spent = usdText({ usd: facts.spentUsd });
  const estimate = facts.hasEstimate ? ', estimated' : '';
  return `${spent} of ${usdText({ usd: facts.capUsd })}${estimate}`;
};

export const autoBudgetPromptLine = ({ facts }: FactsParams): string => {
  const estimate = facts.hasEstimate ? ' (some of it estimated)' : '';
  return [
    `Budget for this conversation: ${usdText({ usd: facts.capUsd })}.`,
    `Spent ${usdText({ usd: facts.spentUsd })}${estimate}.`,
    `Reserved for running agents ${usdText({ usd: facts.reservedUsd })}.`,
    `Left ${usdText({ usd: facts.remainingUsd })}.`,
  ].join(' ');
};
