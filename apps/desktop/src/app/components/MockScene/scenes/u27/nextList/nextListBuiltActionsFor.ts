import { foldedVerbOf } from '../../../../../../features/session/central/next/foldedVerbOf';
import { foldVerbs } from '../../../../../../features/session/central/next/foldVerbs';
import type { ActionCardActions } from '../../../../../../features/session/central/next/useActionCardActions';
import { SESSION_ID } from '../../resolveSeed';
import { nextListBeforeActionsFor } from './nextListBeforeActionsFor';

export const nextListBuiltActionsFor: ActionCardActions['actionsFor'] = ({
  card,
  isNarrow = false,
}) => {
  const actions = nextListBeforeActionsFor({ card, isNarrow });
  const main =
    actions.main === null || card.source.kind !== 'auto'
      ? actions.main
      : { ...actions.main, ariaLabel: `${actions.main.label} the ${card.source.target.noun}` };
  return foldVerbs({
    actions: { ...actions, main },
    sessionId: SESSION_ID,
    verbs: card.folded.map((folded) => foldedVerbOf({ card: folded, run: () => undefined })),
  });
};
