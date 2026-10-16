import { pageCountWordOf, type CountedPageId, type PageCountFacts } from './pageCountWord';

export type PageSlot = {
  readonly count: number | null;
  readonly isRunning: boolean;
  readonly isWarning: boolean;
  readonly fact: string | null;
};

const EMPTY_SLOT: PageSlot = { count: null, isRunning: false, isWarning: false, fact: null };

type CountParams = {
  readonly page: CountedPageId;
  readonly facts: PageCountFacts;
};

const countOf = ({ page, facts }: CountParams): number => {
  switch (page) {
    case 'runs':
      return facts.runs;
    case 'agents':
      return facts.agents;
    case 'artifacts':
      return facts.artifacts;
    case 'questions':
      return facts.openQuestions;
    default: {
      const unreachable: never = page;
      return unreachable;
    }
  }
};

const isRunningOf = ({ page, facts }: CountParams): boolean => {
  if (page === 'runs') {
    return facts.runningRuns > 0;
  }
  if (page === 'agents') {
    return facts.runningAgents > 0;
  }
  return false;
};

type Params = {
  readonly page: CountedPageId | null;
  readonly facts: PageCountFacts;
};

export const pageSlotOf = ({ page, facts }: Params): PageSlot => {
  if (page === null) {
    return EMPTY_SLOT;
  }
  const count = countOf({ page, facts });
  if (count === 0) {
    return EMPTY_SLOT;
  }
  return {
    count,
    isRunning: isRunningOf({ page, facts }),
    isWarning: page === 'questions',
    fact: pageCountWordOf({ page, facts }),
  };
};
