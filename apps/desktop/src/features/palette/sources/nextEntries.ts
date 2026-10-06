import { SUGGESTION_ICONS } from '../../suggestions/suggestionIcons';
import type { SuggestionActions } from '../../suggestions/useSuggestionActions';
import type { SessionSuggestion } from '../../suggestions/types';
import type { PaletteEntry } from '../types';

export type NextItem = {
  readonly suggestion: SessionSuggestion;
  readonly actions: SuggestionActions;
};

type Params = {
  readonly items: ReadonlyArray<NextItem>;
  readonly execute: (item: NextItem) => void;
  readonly limit?: number;
};

const NEXT_LIMIT = 3;

const HIDDEN_KINDS: ReadonlySet<SessionSuggestion['kind']> = new Set<SessionSuggestion['kind']>([
  'mount-project',
]);

export const nextEntries = ({
  items,
  execute,
  limit = NEXT_LIMIT,
}: Params): ReadonlyArray<PaletteEntry> =>
  items
    .filter(
      ({ suggestion, actions }) => actions.primary !== null && !HIDDEN_KINDS.has(suggestion.kind),
    )
    .slice(0, limit)
    .flatMap((item): ReadonlyArray<PaletteEntry> => {
      const { suggestion, actions } = item;
      const primary = actions.primary;
      if (primary === null) {
        return [];
      }
      return [
        {
          key: `next:${suggestion.id}`,
          label: suggestion.title,
          kind: 'next',
          group: null,
          icon: SUGGESTION_ICONS[suggestion.kind],
          ...(suggestion.detail !== undefined && suggestion.detail !== ''
            ? { detail: suggestion.detail }
            : {}),
          ...(suggestion.band === 0 ? { tag: 'Needs you' } : {}),
          isBlocked: primary.isDisabled,
          ...(primary.requiresConfirm === true
            ? {
                confirm: {
                  title: suggestion.title,
                  description: suggestion.detail ?? `${primary.label} now?`,
                  confirmLabel: primary.label,
                  role: 'alert' as const,
                },
              }
            : {}),
          run: () => execute(item),
        },
      ];
    });
