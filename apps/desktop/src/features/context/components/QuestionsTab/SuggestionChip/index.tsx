import { Check } from 'lucide-react';
import { cn } from '@goodboy/ui';

interface Props {
  label: string;
  selected: boolean;
  onToggle: () => void;
}

const isCodeLike = (label: string) => /^\S+$/.test(label) && /[_().:[\]/]/.test(label);

export function SuggestionChip({ label, selected, onToggle }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      title={label}
      className={cn(
        'group inline-flex max-w-full items-center rounded-full border text-xs font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        isCodeLike(label) && 'font-mono text-2xs',
        selected
          ? 'border-transparent bg-primary/10 py-1 pl-1.5 pr-2.5 text-primary ring-1 ring-primary/30 shadow-[inset_0_1px_2px_oklch(from_var(--color-primary)_l_c_h_/_0.18)]'
          : 'border-border-soft bg-muted/40 px-2.5 py-1 text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground active:scale-[0.97]',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'grid shrink-0 place-items-center overflow-hidden transition-all duration-150',
          selected ? 'mr-1 w-3.5 opacity-100' : 'w-0 opacity-0',
        )}
      >
        <Check size={11} strokeWidth={3} />
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}
