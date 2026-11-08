import type { TurnRefusal } from '../types';

type Params = {
  readonly refusal: TurnRefusal;
};

const MESSAGES: Readonly<Record<TurnRefusal, string>> = {
  provider_limit: 'Every provider is over its limit. Change a limit or wait for the next period.',
  folder_busy: 'Another agent is writing in this folder. Try again in a moment.',
  auto_child_unread:
    "Goodboy couldn't check whether this agent works for Auto, so the turn didn't start. Try again in a moment.",
  auto_child_off_route:
    "This agent works for Auto and runs only on the model Auto chose for it, so the turn didn't start. Ask Auto to continue it.",
  auto_child_changed:
    "This agent joined or left Auto while the turn was starting, so the turn didn't start. Send it again.",
};

export const turnRefusalMessage = ({ refusal }: Params): string => MESSAGES[refusal];
