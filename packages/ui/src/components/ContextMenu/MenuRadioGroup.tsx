import { Check } from 'lucide-react';
import { cn } from '../../cn';
import { OptionalTooltip } from '../OptionalTooltip';
import type { MenuRadioEntry } from './menuTypes';
import { ICON_SIZE } from '../../iconSize';

type Props = {
  readonly entry: MenuRadioEntry;
  readonly onChoose: (choice: string) => void;
};

export const MenuRadioGroup = ({ entry, onChoose }: Props) => {
  const isDisabled = entry.isDisabled === true;
  return (
    <div role="group" aria-label={entry.label} className="flex flex-col">
      <div
        role="presentation"
        className="truncate px-2 pt-2 pb-0.5 text-eyebrow text-faint-foreground"
      >
        {entry.label}
      </div>
      {entry.choices.map((choice) => (
        <OptionalTooltip key={choice.id} content={choice.tooltip} side="right">
          <button
            type="button"
            role="menuitemradio"
            aria-checked={choice.isCurrent}
            aria-disabled={isDisabled || undefined}
            aria-description={choice.tooltip ?? undefined}
            tabIndex={-1}
            data-menu-label={choice.label}
            onClick={() => {
              if (isDisabled) {
                return;
              }
              onChoose(choice.id);
            }}
            className={cn(
              'flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left focus-visible:outline-none motion-safe:transition-colors',
              isDisabled
                ? 'cursor-not-allowed text-disabled-foreground focus:bg-hover'
                : 'text-foreground hover:bg-hover focus:bg-hover',
            )}
          >
            <span className="flex size-4 shrink-0 items-center justify-center" aria-hidden>
              {choice.isCurrent ? (
                <Check size={ICON_SIZE.row} aria-hidden className="text-primary" />
              ) : null}
            </span>
            <span className="min-w-0 flex-1 truncate">{choice.label}</span>
            {choice.hint == null ? null : (
              <span className="shrink-0 text-meta tabular-nums text-faint-foreground">
                {choice.hint}
              </span>
            )}
          </button>
        </OptionalTooltip>
      ))}
    </div>
  );
};
