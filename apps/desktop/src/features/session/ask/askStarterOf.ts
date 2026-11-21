import { NAMES } from '../../../shared/utils/names';

export type AskStarter = 'doing' | 'left';

type Params = {
  readonly question: string;
};

const STARTERS: ReadonlyArray<readonly [string, AskStarter]> = [
  [NAMES.whatAreYouDoing, 'doing'],
  [NAMES.whatIsLeft, 'left'],
];

const normalized = ({ question }: Params): string =>
  question.trim().toLowerCase().replace(/\?$/, '').trim();

export const askStarterOf = ({ question }: Params): AskStarter | null => {
  const asked = normalized({ question });
  return STARTERS.find(([text]) => normalized({ question: text }) === asked)?.[1] ?? null;
};
