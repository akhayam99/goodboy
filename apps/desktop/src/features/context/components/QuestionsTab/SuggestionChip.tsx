import { cn } from '@goodboy/ui';

interface SuggestionChipProps {
  label: string;
  selected: boolean;
  onToggle: () => void;
}

export function SuggestionChip({ label, selected, onToggle }: SuggestionChipProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        selected
          ? 'border-primary/40 bg-primary/10 text-primary ring-1 ring-primary/30'
          : 'border-border/40 bg-muted/40 text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground',
      )}
    >
      {label}
    </button>
  );
}
