import { Check } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { OpenQuestionSelectMode } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';

type Props = {
  label: string;
  selected: boolean;
  recommended?: boolean;
  mode?: OpenQuestionSelectMode;
  onToggle: () => void;
};

const isCodeLike = (label: string) => /^\S+$/.test(label) && /[_().:[\]/]/.test(label);

export const SuggestionRow = ({
  label,
  selected,
  recommended = false,
  mode = 'one',
  onToggle,
}: Props) => {
  const role = mode === 'many' ? 'checkbox' : 'radio';
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      onClick={onToggle}
      title={recommended ? `${label} (suggested)` : label}
      className={cn(
        'group flex w-full items-start gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs font-medium',
        'transition-[color,background-color,border-color,box-shadow] duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        isCodeLike(label) && 'font-mono text-2xs',
        selected
          ? 'shadow-inset-primary border-transparent bg-primary/10 text-primary ring-1 ring-primary/30'
          : recommended
            ? 'border-warning/40 bg-warning/10 text-foreground ring-1 ring-warning/30 hover:border-warning/60 hover:bg-warning/15'
            : 'border-border-soft bg-muted/40 text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground',
      )}
    >
      <span aria-hidden className="grid w-3.5 shrink-0 translate-y-0.5 place-items-center">
        {selected ? (
          <Check size={11} strokeWidth={3} />
        ) : recommended ? (
          <CONCEPT_ICONS.suggestion size={11} className="text-info" />
        ) : null}
      </span>
      <span className="min-w-0 flex-1 whitespace-normal break-words">{label}</span>
    </button>
  );
};
