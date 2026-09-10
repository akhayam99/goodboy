import { ChevronDown } from 'lucide-react';
import { AnchoredPopover, Button, cn, useDropdown } from '@goodboy/ui';
import { ICON_SIZE } from '../../../shared/components/conceptIcons';
import type { SuggestionAction, SuggestionActionChoice } from '../useSuggestionActions';

type Props = {
  readonly action: SuggestionAction;
  readonly appearance: 'outline' | 'ghost';
};

type ChooseParams = {
  readonly choice: SuggestionActionChoice;
  readonly close: () => void;
};

const choose = ({ choice, close }: ChooseParams) => {
  close();
  choice.onAct();
};

export const SuggestionActionButton = ({ action, appearance }: Props) => {
  const choices = action.choices ?? [];
  const dropdown = useDropdown({
    align: 'end',
    width: 'w-72',
    expectedHeight: Math.min(320, 16 + choices.length * 44),
  });
  const buttonClassName = appearance === 'ghost' ? 'h-6' : undefined;

  if (choices.length <= 1) {
    return (
      <Button
        variant={appearance === 'ghost' ? 'ghost' : 'secondary'}
        emphasis={appearance === 'ghost' ? 'solid' : 'outline'}
        size="sm"
        className={buttonClassName}
        disabled={action.isDisabled}
        onClick={action.onAct}
      >
        {action.label}
      </Button>
    );
  }

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="menu"
      ariaLabel="Choose rebase target"
      trigger={
        <Button
          variant={appearance === 'ghost' ? 'ghost' : 'secondary'}
          emphasis={appearance === 'ghost' ? 'solid' : 'outline'}
          size="sm"
          className={buttonClassName}
          disabled={action.isDisabled}
          onClick={dropdown.toggle}
          aria-haspopup="menu"
          aria-expanded={dropdown.open}
        >
          {action.label}
          <ChevronDown
            size={ICON_SIZE.row}
            aria-hidden
            className={cn('motion-safe:transition-transform', dropdown.open && 'rotate-180')}
          />
        </Button>
      }
    >
      <div className="flex flex-col py-1">
        {choices.map((choice) => (
          <button
            key={choice.id}
            type="button"
            role="menuitem"
            onClick={() => choose({ choice, close: dropdown.close })}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-foreground motion-safe:transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-focus-ring)]"
          >
            <span className="flex min-w-0 flex-1 items-baseline gap-2">
              <span className="truncate text-xs font-medium">{choice.label}</span>
              <span className="truncate text-2xs text-muted-foreground">{choice.description}</span>
            </span>
            <span className="shrink-0 text-2xs tabular-nums text-muted-foreground">
              {choice.detail}
            </span>
          </button>
        ))}
      </div>
    </AnchoredPopover>
  );
};
