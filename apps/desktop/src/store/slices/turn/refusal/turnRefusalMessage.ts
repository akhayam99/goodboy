import type { TurnRefusal } from '../types';

type Params = {
  readonly refusal: TurnRefusal;
};

const MESSAGES: Readonly<Record<TurnRefusal, string>> = {
  provider_limit: 'Every provider is over its limit. Change a limit or wait for the next period.',
  folder_busy: 'Another agent is writing in this folder. Try again in a moment.',
  auto_child_unread:
    "Couldn't read this agent's role in Auto, so the turn didn't start. Try again in a moment.",
  auto_child_off_route:
    'This agent works for Auto and runs only on the model Auto picked for it. Ask Auto to continue it.',
};

export const turnRefusalMessage = ({ refusal }: Params): string => MESSAGES[refusal];
