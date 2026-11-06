import type { TurnRefusal } from './types';

type Params = {
  readonly refusal: TurnRefusal;
};

const MESSAGES: Readonly<Record<TurnRefusal, string>> = {
  provider_limit: 'Every provider is over its limit. Change a limit or wait for the next period.',
  folder_busy: 'Another agent is writing in this folder. Try again in a moment.',
};

export const turnRefusalMessage = ({ refusal }: Params): string => MESSAGES[refusal];
