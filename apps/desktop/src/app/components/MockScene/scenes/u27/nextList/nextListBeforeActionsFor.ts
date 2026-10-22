import type { ActionCardModel } from '../../../../../../features/session/central/next/actionCardsOf';
import { foldSecondVerb } from '../../../../../../features/session/central/next/foldSecondVerb';
import type {
  ActionCardActions,
  CardActions,
} from '../../../../../../features/session/central/next/useActionCardActions';
import type { SessionSuggestion } from '../../../../../../features/suggestions/types';
import { SESSION_ID } from '../../resolveSeed';
import { nextListVerbOf } from './nextListVerbOf';

const SUGGESTION_VERB: Partial<Record<SessionSuggestion['kind'], string>> = {
  'answer-questions': 'Answer',
  'fix-checks': 'Analyze',
  'resolve-threads': 'Fix',
  'rebase-project': 'Rebase',
  'push-branch': 'Push',
  'open-pr': 'Open PR',
  'mark-ready': 'Mark ready',
  'close-worktree': 'Remove',
};

type CardParams = {
  readonly card: ActionCardModel;
};

const IDLE = {
  failure: null,
  isBusy: false,
  agentKind: null,
  foldedTarget: null,
} as const;

type SuggestionParams = {
  readonly suggestion: SessionSuggestion;
};

const suggestionLabelOf = ({ suggestion }: SuggestionParams): string => {
  if (suggestion.kind === 'push-branch' && suggestion.payload.state === 'diverged') {
    return 'Review';
  }
  return SUGGESTION_VERB[suggestion.kind] ?? 'Open';
};

const baseActionsOf = ({ card }: CardParams): CardActions => {
  const { source } = card;
  switch (source.kind) {
    case 'owner':
      return {
        ...IDLE,
        main: nextListVerbOf({ label: source.owner.kind === 'rebase' ? 'Open rebase' : 'Answer' }),
        second: null,
        menu: null,
      };
    case 'auto': {
      const { target } = source;
      if (!target.canRetry) {
        return {
          ...IDLE,
          main: nextListVerbOf({ label: target.kind === 'approve' ? 'Review plan' : 'Open Auto' }),
          second: null,
          menu: null,
        };
      }
      return {
        ...IDLE,
        main: nextListVerbOf({ label: 'Retry', ariaLabel: `Retry "${target.role}"` }),
        second: nextListVerbOf({ label: 'Open Auto' }),
        menu: null,
      };
    }
    case 'suggestion':
      return {
        ...IDLE,
        main: nextListVerbOf({ label: suggestionLabelOf({ suggestion: source.suggestion }) }),
        second: null,
        menu: {
          target: {
            kind: 'suggestion',
            sessionId: SESSION_ID,
            suggestion: source.suggestion,
            startsRole: null,
            isAutoOn: false,
            onNotNow: () => undefined,
          },
          pendingChoiceIds: new Set(),
          isHeld: false,
          isDisabled: false,
          trackChoice: ({ task }) => task(),
        },
      };
    default: {
      const exhaustive: never = source;
      return exhaustive;
    }
  }
};

export const nextListBeforeActionsFor: ActionCardActions['actionsFor'] = ({
  card,
  isNarrow = false,
}) => {
  const actions = baseActionsOf({ card });
  return isNarrow ? foldSecondVerb({ actions, sessionId: SESSION_ID }) : actions;
};
