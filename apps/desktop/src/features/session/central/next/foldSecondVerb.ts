import type { SessionId } from '@goodboy/types';
import { foldVerbs } from './foldVerbs';
import type { CardActions } from './useActionCardActions';

type Params = {
  readonly actions: CardActions;
  readonly sessionId: SessionId;
};

export const foldSecondVerb = ({ actions, sessionId }: Params): CardActions => {
  const second = actions.second;
  if (second === null) {
    return actions;
  }
  return foldVerbs({
    actions: { ...actions, second: null },
    sessionId,
    verbs: [{ id: 'second', label: second.label, run: second.run }],
  });
};
