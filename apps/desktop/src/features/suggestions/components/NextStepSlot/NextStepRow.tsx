import { MoreHorizontal } from 'lucide-react';
import { AnchoredPopover, Button, IconButton, cn, tintClasses, useDropdown } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { SUGGESTION_ICONS } from '../../suggestionIcons';
import type { NextStepBand, SessionSuggestion } from '../../types';
import type { SuggestionActions } from '../../useSuggestionActions';

const BAND_TONE: Record<NextStepBand, 'warning' | 'info' | 'primary' | 'neutral'> = {
  0: 'warning',
  1: 'info',
  2: 'primary',
  3: 'neutral',
};

type Props = {
  readonly suggestion: SessionSuggestion;
  readonly actions: SuggestionActions;
  readonly compact: boolean;
  readonly onNotNow: () => void;
};

export const NextStepRow = ({ suggestion, actions, compact, onNotNow }: Props) => {
  const Icon = SUGGESTION_ICONS[suggestion.kind];
  const tone = BAND_TONE[suggestion.band];
  const dropdown = useDropdown({ align: 'end', expectedWidth: 160, expectedHeight: 80 });
  return (
    <div
      data-testid={`next-step-${suggestion.id}`}
      className={cn(
        'flex min-w-0 items-center gap-2 rounded-md bg-subtle px-2',
        compact ? 'py-1' : 'py-2',
      )}
    >
      <Icon size={ICON_SIZE.row} aria-hidden className={cn('shrink-0', tintClasses(tone).icon)} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-foreground">{suggestion.title}</span>
        {!compact && suggestion.detail != null && (
          <span className="truncate text-xs text-muted-foreground">{suggestion.detail}</span>
        )}
      </span>
      {actions.primary != null && (
        <Button
          size="sm"
          variant={suggestion.band === 0 ? 'primary' : 'secondary'}
          disabled={actions.primary.isDisabled}
          onClick={actions.primary.onAct}
        >
          {actions.primary.label}
        </Button>
      )}
      <AnchoredPopover
        dropdown={dropdown}
        role="menu"
        ariaLabel={`More actions for ${suggestion.title}`}
        className="w-40 p-1"
        trigger={
          <IconButton
            icon={MoreHorizontal}
            label={`More actions for ${suggestion.title}`}
            variant="ghost"
            onClick={dropdown.toggle}
          />
        }
      >
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            dropdown.close();
            onNotNow();
            actions.onDismiss?.();
          }}
          className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-hover"
        >
          Not now
        </button>
      </AnchoredPopover>
    </div>
  );
};
