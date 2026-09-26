import { X } from 'lucide-react';
import { Tooltip, cn, tintClasses } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../../../shared/components/conceptIcons';
import { SuggestionActionButton } from '../../../../../../suggestions/components/SuggestionActionButton';
import { SUGGESTION_ICONS } from '../../../../../../suggestions/suggestionIcons';
import type { SessionSuggestion } from '../../../../../../suggestions';
import type { SuggestionActions } from '../../../../../../suggestions/useSuggestionActions';

type Props = {
  readonly suggestion: SessionSuggestion;
  readonly actions: SuggestionActions;
};

export const TimelineSuggestionItem = ({ suggestion, actions }: Props) => {
  const Icon = SUGGESTION_ICONS[suggestion.kind];
  return (
    <li
      data-testid={`timeline-suggestion-${suggestion.id}`}
      className="flex min-h-6 min-w-0 items-center gap-2"
    >
      <Icon size={ICON_SIZE.row} aria-hidden className={cn('shrink-0', tintClasses('info').icon)} />
      <span className="truncate text-label font-medium text-foreground">{suggestion.title}</span>
      {suggestion.detail == null ? null : (
        <span className="truncate text-2xs text-muted-foreground @max-md/activity:hidden">
          {suggestion.detail}
        </span>
      )}
      <span className="ml-auto flex shrink-0 items-center gap-0.5">
        {actions.primary == null ? null : (
          <SuggestionActionButton action={actions.primary} appearance="ghost" />
        )}
        {actions.onDismiss == null ? null : (
          <Tooltip content="Dismiss this suggestion">
            <button
              type="button"
              onClick={actions.onDismiss}
              aria-label="Dismiss this suggestion"
              className="rounded-md p-1 text-muted-foreground motion-safe:transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <X size={ICON_SIZE.row} aria-hidden />
            </button>
          </Tooltip>
        )}
      </span>
    </li>
  );
};
