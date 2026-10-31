import { useId, type ReactNode } from 'react';
import { cn, FOCUS_RING } from '@goodboy/ui';
import type { OpenQuestionSelectMode } from '@goodboy/types';
import { SelectionIndicator } from './SelectionIndicator';

type Props = {
  readonly label: string;
  readonly keyHint: ReactNode;
  readonly selected: boolean;
  readonly recommended?: boolean;
  readonly mode?: OpenQuestionSelectMode;
  readonly dimmed?: boolean;
  readonly disabled?: boolean;
  readonly children?: ReactNode;
  readonly onToggle: () => void;
};

export const AnswerOptionRow = ({
  label,
  keyHint,
  selected,
  recommended = false,
  mode = 'one',
  dimmed = false,
  disabled = false,
  children,
  onToggle,
}: Props) => {
  const recommendedId = useId();
  const isMany = mode === 'many';

  return (
    <div
      data-selected={selected ? '' : undefined}
      className={cn(
        'relative grid min-h-8 items-center gap-3 rounded-md px-2 py-1',
        isMany ? 'grid-cols-[16px_minmax(0,1fr)_16px]' : 'grid-cols-[16px_minmax(0,1fr)]',
        'motion-safe:transition-[background-color,opacity] motion-safe:duration-150',
        selected && 'bg-selected',
        !selected && !disabled && 'hover:bg-hover',
        dimmed && 'opacity-50',
      )}
    >
      <span
        aria-hidden
        className="grid h-5 place-items-center text-meta tabular-nums text-muted-foreground"
      >
        {keyHint}
      </span>
      <span className="flex min-w-0 flex-col gap-2">
        <button
          type="button"
          role={isMany ? 'checkbox' : 'radio'}
          aria-checked={selected}
          aria-label={label}
          aria-describedby={recommended ? recommendedId : undefined}
          aria-disabled={disabled ? true : undefined}
          onClick={disabled ? undefined : onToggle}
          className={cn(
            'flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-sm text-left text-row text-foreground',
            FOCUS_RING,
            'after:absolute after:inset-0 after:rounded-md after:content-[""]',
            disabled ? 'cursor-default' : 'cursor-pointer',
          )}
        >
          <span className="min-w-0 break-words">{label}</span>
          {recommended && (
            <span id={recommendedId} className="shrink-0 text-meta text-muted-foreground">
              Recommended
            </span>
          )}
        </button>
        {children}
      </span>
      {isMany ? <SelectionIndicator mode={mode} selected={selected} /> : null}
    </div>
  );
};
