import type { SessionId } from '@goodboy/types';
import type { FoldedVerb } from '../../../actions/types';
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
  const folded: FoldedVerb = { id: 'second', label: second.label, run: second.run };
  if (actions.menu !== null) {
    return {
      ...actions,
      second: null,
      menu: { ...actions.menu, target: { ...actions.menu.target, foldedVerbs: [folded] } },
    };
  }
  return {
    ...actions,
    second: null,
    foldedTarget: { kind: 'actionCard', sessionId, verbs: [folded] },
  };
};
