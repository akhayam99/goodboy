export type CountedPageId = 'branch' | 'runs' | 'agents' | 'artifacts' | 'questions';

export type PageCountFacts = {
  readonly waiting: number;
  readonly mounts: number;
  readonly runs: number;
  readonly runningRuns: number;
  readonly agents: number;
  readonly runningAgents: number;
  readonly artifacts: number;
  readonly openQuestions: number;
};

export type PageSummaries = Partial<Record<CountedPageId, string>>;

type NounParams = {
  readonly count: number;
  readonly noun: string;
};

const nounOf = ({ count, noun }: NounParams): string => `${count} ${noun}${count === 1 ? '' : 's'}`;

type RunningParams = {
  readonly running: number;
  readonly total: number;
  readonly noun: string;
};

const runningOr = ({ running, total, noun }: RunningParams): string | null => {
  if (running > 0) {
    return `${running} running`;
  }
  return total > 0 ? nounOf({ count: total, noun }) : null;
};

const COUNT_WORD: Readonly<Record<CountedPageId, (facts: PageCountFacts) => string | null>> = {
  branch: (facts) => {
    if (facts.waiting > 0) {
      return `${facts.waiting} need you`;
    }
    return facts.mounts > 1 ? `${facts.mounts} branches` : null;
  },
  runs: (facts) => runningOr({ running: facts.runningRuns, total: facts.runs, noun: 'run' }),
  agents: (facts) =>
    runningOr({ running: facts.runningAgents, total: facts.agents, noun: 'agent' }),
  artifacts: (facts) =>
    facts.artifacts > 0 ? nounOf({ count: facts.artifacts, noun: 'artifact' }) : null,
  questions: (facts) => (facts.openQuestions > 0 ? `${facts.openQuestions} open` : null),
};

export const COUNTED_PAGE_IDS = Object.keys(COUNT_WORD) as ReadonlyArray<CountedPageId>;

type WordParams = {
  readonly page: CountedPageId;
  readonly facts: PageCountFacts;
};

export const pageCountWordOf = ({ page, facts }: WordParams): string | null =>
  COUNT_WORD[page](facts);
