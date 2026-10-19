import { choiceKey } from './choiceKey';
import type { SessionSuggestion } from './types';

type Params = {
  readonly suggestion: SessionSuggestion;
  readonly pendingKeys: ReadonlySet<string>;
};

export const pendingChoiceIds = ({ suggestion, pendingKeys }: Params): ReadonlySet<string> => {
  const prefix = choiceKey({ suggestion, choiceId: '' });
  return new Set(
    [...pendingKeys].flatMap((key) => (key.startsWith(prefix) ? [key.slice(prefix.length)] : [])),
  );
};
