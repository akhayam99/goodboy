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

export const SuggestionChip = ({
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
        'group inline-flex min-w-0 max-w-40 items-center gap-1 rounded-md border text-xs font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        isCodeLike(label) && 'font-mono text-2xs',
        selected
          ? 'shadow-inset-primary border-transparent bg-primary/10 py-1 pl-1.5 pr-2.5 text-primary ring-1 ring-primary/30'
          : recommended
            ? 'border-warning/40 bg-warning/10 px-2.5 py-1 text-foreground ring-1 ring-warning/30 hover:border-warning/60 hover:bg-warning/15 active:scale-[0.97]'
            : 'border-border-soft bg-muted/40 px-2.5 py-1 text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground active:scale-[0.97]',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'grid shrink-0 place-items-center overflow-hidden motion-safe:transition-all duration-150',
          selected ? 'w-3.5 opacity-100' : 'w-0 opacity-0',
        )}
      >
        <Check size={11} strokeWidth={3} />
      </span>
      {recommended && !selected && (
        <CONCEPT_ICONS.suggestion size={11} aria-hidden className="shrink-0 text-info" />
      )}
      <span className="min-w-0 truncate text-left">{label}</span>
    </button>
  );
};
