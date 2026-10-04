import { useId, type ReactNode } from 'react';
import { Chip, cn } from '@goodboy/ui';
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

  return (
    <div
      data-selected={selected ? '' : undefined}
      className={cn(
        'relative grid grid-cols-[20px_minmax(0,1fr)_16px] items-start gap-3 rounded-md border px-2.5 py-2',
        'motion-safe:transition-[background-color,border-color,opacity] motion-safe:duration-150',
        selected ? 'border-border bg-fill bg-selected' : 'border-border-soft bg-fill',
        !selected && !disabled && 'hover:border-border',
        dimmed && 'opacity-50',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'grid size-5 place-items-center rounded-sm text-chip',
          selected ? 'bg-hover text-foreground' : 'bg-fill text-faint-foreground',
        )}
      >
        {keyHint}
      </span>
      <span className="flex min-w-0 flex-col gap-1.5">
        <button
          type="button"
          role={mode === 'many' ? 'checkbox' : 'radio'}
          aria-checked={selected}
          aria-label={label}
          aria-describedby={recommended ? recommendedId : undefined}
          aria-disabled={disabled ? true : undefined}
          onClick={disabled ? undefined : onToggle}
          className={cn(
            'flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-sm text-left text-row text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
            'after:absolute after:inset-0 after:rounded-md after:content-[""]',
            disabled ? 'cursor-default' : 'cursor-pointer',
          )}
        >
          <span className="min-w-0 break-words">{label}</span>
          {recommended && (
            <span id={recommendedId} className="flex">
              <Chip tone="primary" label="Recommended" shape="badge" bordered={false} />
            </span>
          )}
        </button>
        {children}
      </span>
      <SelectionIndicator mode={mode} selected={selected} />
    </div>
  );
};
