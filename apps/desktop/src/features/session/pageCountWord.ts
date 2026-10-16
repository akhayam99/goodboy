export type CountedPageId = 'runs' | 'orchestrated' | 'agents' | 'auto' | 'artifacts' | 'questions';

export type PageCountFacts = {
  readonly runs: number;
  readonly runningRuns: number;
  readonly orchestratedRuns: number;
  readonly runningOrchestratedRuns: number;
  readonly agents: number;
  readonly runningAgents: number;
  readonly autoAgents: number;
  readonly workingAutoAgents: number;
  readonly artifacts: number;
  readonly openQuestions: number;
};

const RUNNING_SUFFIX = ' running';

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
    return `${running}${RUNNING_SUFFIX}`;
  }
  return total > 0 ? nounOf({ count: total, noun }) : null;
};

const COUNT_WORD: Readonly<Record<CountedPageId, (facts: PageCountFacts) => string | null>> = {
  runs: (facts) => runningOr({ running: facts.runningRuns, total: facts.runs, noun: 'run' }),
  orchestrated: (facts) =>
    runningOr({
      running: facts.runningOrchestratedRuns,
      total: facts.orchestratedRuns,
      noun: 'run',
    }),
  agents: (facts) =>
    runningOr({ running: facts.runningAgents, total: facts.agents, noun: 'agent' }),
  auto: (facts) => {
    if (facts.workingAutoAgents > 0) {
      return `${facts.workingAutoAgents} working`;
    }
    return facts.autoAgents > 0 ? nounOf({ count: facts.autoAgents, noun: 'conversation' }) : null;
  },
  artifacts: (facts) =>
    facts.artifacts > 0 ? nounOf({ count: facts.artifacts, noun: 'artifact' }) : null,
  questions: (facts) => (facts.openQuestions > 0 ? `${facts.openQuestions} open` : null),
};

type WordParams = {
  readonly page: CountedPageId;
  readonly facts: PageCountFacts;
};

export const pageCountWordOf = ({ page, facts }: WordParams): string | null =>
  COUNT_WORD[page](facts);
