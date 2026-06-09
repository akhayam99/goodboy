import { Check } from 'lucide-react';
import { cn } from '@goodboy/ui';

type Props = {
  label: string;
  selected: boolean;
  onToggle: () => void;
};

export function SuggestionChip({ label, selected, onToggle }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={cn(
        'group inline-flex items-center rounded-full border text-xs font-medium transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        selected
          ? 'border-primary/50 bg-primary/10 py-1 pl-1.5 pr-2.5 text-primary shadow-[0_0_0_1px_var(--color-primary)]'
          : 'border-border-soft bg-muted/40 px-2.5 py-1 text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground active:scale-[0.97]',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'grid place-items-center overflow-hidden transition-all duration-150',
          selected ? 'mr-1 w-3.5 opacity-100' : 'w-0 opacity-0',
        )}
      >
        <Check size={11} strokeWidth={3} />
      </span>
      {label}
    </button>
  );
}
