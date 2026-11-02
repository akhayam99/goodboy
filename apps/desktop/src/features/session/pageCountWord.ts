import { countNoun } from '../../shared/utils/countNoun';
import { needsYouText } from '../../shared/utils/needsYouText';
export type CountedPageId = 'files' | 'runs' | 'artifacts' | 'questions';

export type PageCountFacts = {
  readonly changedFiles: number;
  readonly runs: number;
  readonly runningRuns: number;
  readonly waitingRuns: number;
  readonly artifacts: number;
  readonly openQuestions: number;
};

const RUNNING_SUFFIX = ' running';

type RunningParams = {
  readonly running: number;
  readonly total: number;
  readonly noun: string;
  readonly waiting?: number;
};

const runningOr = ({ running, total, noun, waiting = 0 }: RunningParams): string | null => {
  if (waiting > 0) {
    return needsYouText({ count: waiting, unit: 'items' });
  }
  if (running > 0) {
    return `${running}${RUNNING_SUFFIX}`;
  }
  return total > 0 ? countNoun({ count: total, one: noun }) : null;
};

const COUNT_WORD: Readonly<Record<CountedPageId, (facts: PageCountFacts) => string | null>> = {
  files: (facts) =>
    facts.changedFiles > 0 ? countNoun({ count: facts.changedFiles, one: 'file' }) : null,
  runs: (facts) =>
    runningOr({
      running: facts.runningRuns,
      total: facts.runs,
      noun: 'run',
      waiting: facts.waitingRuns,
    }),
  artifacts: (facts) =>
    facts.artifacts > 0 ? countNoun({ count: facts.artifacts, one: 'artifact' }) : null,
  questions: (facts) =>
    facts.openQuestions > 0 ? countNoun({ count: facts.openQuestions, one: 'question' }) : null,
};

type WordParams = {
  readonly page: CountedPageId;
  readonly facts: PageCountFacts;
};

export const pageCountWordOf = ({ page, facts }: WordParams): string | null =>
  COUNT_WORD[page](facts);
