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

type AutoTreeSpendOfParams = Omit<AutoTreeSpend, 'remainingUsd'>;

export const autoTreeSpendOf = ({
  capUsd,
  settledUsd,
  reservedUsd,
  estimatedUsd,
}: AutoTreeSpendOfParams): AutoTreeSpend => ({
  capUsd,
  settledUsd,
  reservedUsd,
  remainingUsd: capUsd - settledUsd - reservedUsd,
  estimatedUsd,
});

type BudgetFactsParams = {
  readonly spend: AutoTreeSpend;
};

export const autoBudgetFacts = ({ spend }: BudgetFactsParams): AutoBudgetFacts => ({
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

export const autoBudgetLabel = ({ facts }: FactsParams): string => {
  const spent = usdText({ usd: facts.spentUsd });
  const estimate = facts.hasEstimate ? ', estimated' : '';
  return `${spent} of ${usdText({ usd: facts.capUsd })}${estimate}`;
};

type PromptLineParams = FactsParams & {
  readonly turnReservedUsd: number;
};

export const autoBudgetPromptLine = ({ facts, turnReservedUsd }: PromptLineParams): string => {
  const estimate = facts.hasEstimate ? ' (some of it estimated)' : '';
  const reserved =
    turnReservedUsd > 0
      ? `Reserved ${usdText({ usd: facts.reservedUsd })}, of which ${usdText({ usd: roundUsd({ usd: turnReservedUsd }) })} for this answer.`
      : `Reserved for running agents ${usdText({ usd: facts.reservedUsd })}.`;
  return [
    `Budget for this conversation: ${usdText({ usd: facts.capUsd })}.`,
    `Spent ${usdText({ usd: facts.spentUsd })}${estimate}.`,
    reserved,
    `Left ${usdText({ usd: facts.remainingUsd })}.`,
  ].join(' ');
};
