import { countSlotText } from '../../shared/utils/countSlotText';
import { pageCountWordOf, type CountedPageId, type PageCountFacts } from './pageCountWord';

type PageSlotTone = 'info' | 'warning';

export type PageSlot = {
  readonly text: string | null;
  readonly tone: PageSlotTone | null;
  readonly fact: string | null;
};

const EMPTY_SLOT: PageSlot = { text: null, tone: null, fact: null };

type CountParams = {
  readonly page: CountedPageId;
  readonly facts: PageCountFacts;
};

const countOf = ({ page, facts }: CountParams): number => {
  switch (page) {
    case 'files':
      return facts.changedFiles;
    case 'runs':
      return facts.runs;
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

type LiveCount = {
  readonly tone: PageSlotTone;
  readonly count: number;
};

const liveCountOf = ({ page, facts }: CountParams): LiveCount | null => {
  const counts: Readonly<Record<CountedPageId, ReadonlyArray<LiveCount>>> = {
    files: [],
    runs: [
      { tone: 'warning', count: facts.waitingRuns },
      { tone: 'info', count: facts.runningRuns },
    ],
    artifacts: [],
    questions: [{ tone: 'warning', count: facts.openQuestions }],
  };
  return counts[page].find((live) => live.count > 0) ?? null;
};

type Params = {
  readonly page: CountedPageId | null;
  readonly facts: PageCountFacts;
};

export const pageSlotOf = ({ page, facts }: Params): PageSlot => {
  if (page === null) {
    return EMPTY_SLOT;
  }
  const total = countOf({ page, facts });
  if (total === 0) {
    return EMPTY_SLOT;
  }
  const live = liveCountOf({ page, facts });
  return {
    text: countSlotText({ count: live === null ? total : live.count }),
    tone: live === null ? null : live.tone,
    fact: pageCountWordOf({ page, facts }),
  };
};
