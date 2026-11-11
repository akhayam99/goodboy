import type { FindOutcome } from './hooks/useFindInPage';

type Params = {
  readonly outcome: FindOutcome;
};

const WORDS: Readonly<Record<FindOutcome, string>> = {
  idle: '',
  found: 'Found',
  missing: 'Not found',
  failed: "Couldn't search this page",
};

export const findOutcomeText = ({ outcome }: Params): string => WORDS[outcome];
