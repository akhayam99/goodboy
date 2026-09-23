import { useId } from 'react';
import { cn, tintClasses } from '@goodboy/ui';
import type { OpenQuestionSelectMode } from '@goodboy/types';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { SelectionIndicator } from './SelectionIndicator';

const RECOMMENDED_DESCRIPTION = 'Recommended answer';

type Props = {
  readonly label: string;
  readonly selected: boolean;
  readonly recommended?: boolean;
  readonly mode?: OpenQuestionSelectMode;
  readonly onToggle: () => void;
};

export const AnswerOptionRow = ({
  label,
  selected,
  recommended = false,
  mode = 'one',
  onToggle,
}: Props) => {
  const descriptionId = useId();
  const role = mode === 'many' ? 'checkbox' : 'radio';

  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      aria-label={label}
      aria-describedby={recommended ? descriptionId : undefined}
      onClick={onToggle}
      className={cn(
        'flex w-full items-start justify-between gap-2 rounded-md border px-2 py-1.5 text-left text-sm font-medium',
        'transition-[color,background-color,border-color] duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
        selected
          ? cn(tintClasses('primary').border, tintClasses('primary').bg, 'text-primary')
          : 'border-border-soft bg-transparent text-foreground hover:border-border hover:bg-hover',
      )}
    >
      <span className="flex min-w-0 items-start gap-2">
        <SelectionIndicator mode={mode} selected={selected} />
        <span className="min-w-0 whitespace-normal break-words">{label}</span>
      </span>
      {recommended && (
        <span className="flex shrink-0 translate-y-0.5 items-center">
          <CONCEPT_ICONS.suggestion
            size={ICON_SIZE.row}
            aria-hidden
            className="text-muted-foreground"
          />
          <span id={descriptionId} className="sr-only">
            {RECOMMENDED_DESCRIPTION}
          </span>
        </span>
      )}
    </button>
  );
};
