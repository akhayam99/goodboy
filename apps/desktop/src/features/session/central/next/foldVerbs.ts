import type { SessionId } from '@goodboy/types';
import type { FoldedVerb } from '../../../actions/types';
import type { CardActions } from './useActionCardActions';

type Params = {
  readonly actions: CardActions;
  readonly sessionId: SessionId;
  readonly verbs: ReadonlyArray<FoldedVerb>;
};

export const foldVerbs = ({ actions, sessionId, verbs }: Params): CardActions => {
  if (verbs.length === 0) {
    return actions;
  }
  if (actions.menu !== null) {
    const target = actions.menu.target;
    return {
      ...actions,
      menu: {
        ...actions.menu,
        target: { ...target, foldedVerbs: [...(target.foldedVerbs ?? []), ...verbs] },
      },
    };
  }
  return {
    ...actions,
    foldedTarget: {
      kind: 'actionCard',
      sessionId,
      verbs: [...(actions.foldedTarget?.verbs ?? []), ...verbs],
    },
  };
};
