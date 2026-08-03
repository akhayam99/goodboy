import type { ReactNode } from 'react';
import { cn } from '@goodboy/ui';
import { ChevronDown } from 'lucide-react';

type Props = {
  readonly icon: ReactNode;
  readonly label: string;
  readonly controls: string;
  readonly isOpen: boolean;
  readonly needsAttention: boolean;
  readonly onToggle: () => void;
};

export const ConfigToggle = ({
  icon,
  label,
  controls,
  isOpen,
  needsAttention,
  onToggle,
}: Props) => {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`Session setup: ${label}`}
      aria-expanded={isOpen}
      aria-controls={controls}
      className={cn(
        'inline-flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-2xs ring-1 motion-safe:transition-colors',
        needsAttention
          ? 'bg-warning/10 text-warning ring-warning/30'
          : 'bg-muted/20 text-muted-foreground ring-border-soft hover:text-foreground',
      )}
    >
      <span className="flex shrink-0 items-center">{icon}</span>
      <span className="truncate font-mono">{label}</span>
      <ChevronDown
        size={11}
        aria-hidden
        className={cn('shrink-0 motion-safe:transition-transform', isOpen && 'rotate-180')}
      />
    </button>
  );
};
