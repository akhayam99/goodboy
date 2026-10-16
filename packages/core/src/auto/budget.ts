import type { AutoTreeSpend } from '@goodboy/db';

export type AutoBudgetFacts = Readonly<{
  capUsd: number | null;
  spentUsd: number;
  reservedUsd: number;
  remainingUsd: number | null;
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
  remainingUsd: capUsd === null ? null : capUsd - settledUsd - reservedUsd,
  estimatedUsd,
});

type BudgetOfParams = {
  readonly spend: AutoTreeSpend;
};

export const autoBudgetOf = ({ spend }: BudgetOfParams): AutoBudgetFacts => ({
  capUsd: spend.capUsd === null ? null : roundUsd({ usd: spend.capUsd }),
  spentUsd: roundUsd({ usd: spend.settledUsd }),
  reservedUsd: roundUsd({ usd: spend.reservedUsd }),
  remainingUsd:
    spend.remainingUsd === null ? null : Math.max(0, roundUsd({ usd: spend.remainingUsd })),
  hasEstimate: spend.estimatedUsd > 0,
});

type SpendParams = {
  readonly spend: AutoTreeSpend | null;
};

export const autoRemainingForGates = ({ spend }: SpendParams): number => {
  if (spend === null) {
    return 0;
  }
  return spend.remainingUsd ?? Number.POSITIVE_INFINITY;
};

type FactsParams = {
  readonly facts: AutoBudgetFacts;
};

const usdText = ({ usd }: RoundUsdParams): string => `${usd.toFixed(2)} USD`;

const dollarText = ({ usd }: RoundUsdParams): string => `$${usd.toFixed(2)}`;

export const autoBudgetUsedUsd = ({ facts }: FactsParams): number =>
  roundUsd({ usd: facts.spentUsd + facts.reservedUsd });

export const capTextOf = ({ facts }: FactsParams): string =>
  facts.capUsd === null ? 'No cap' : `Limit ${dollarText({ usd: facts.capUsd })}`;

export const autoBudgetLabel = ({ facts }: FactsParams): string => {
  const spent = usdText({ usd: facts.spentUsd });
  const estimate = facts.hasEstimate ? ', estimated' : '';
  if (facts.capUsd === null) {
    return `${spent}, no cap${estimate}`;
  }
  return `${spent} of ${usdText({ usd: facts.capUsd })}${estimate}`;
};

type PromptLineParams = FactsParams & {
  readonly turnReservedUsd: number;
};

export const autoBudgetPromptLine = ({ facts, turnReservedUsd }: PromptLineParams): string => {
  const estimate = facts.hasEstimate ? ' (some of it estimated)' : '';
  const spent = `Spent ${usdText({ usd: facts.spentUsd })}${estimate}.`;
  const reserved =
    turnReservedUsd > 0
      ? `Reserved ${usdText({ usd: facts.reservedUsd })}, of which ${usdText({ usd: roundUsd({ usd: turnReservedUsd }) })} for this answer.`
      : `Reserved for running agents ${usdText({ usd: facts.reservedUsd })}.`;
  if (facts.capUsd === null || facts.remainingUsd === null) {
    return ['Budget for this conversation: no cap.', spent, reserved].join(' ');
  }
  return [
    `Budget for this conversation: ${usdText({ usd: facts.capUsd })}.`,
    spent,
    reserved,
    `Left ${usdText({ usd: facts.remainingUsd })}.`,
  ].join(' ');
};
