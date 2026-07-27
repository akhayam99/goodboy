import { ArrowRight, Plus } from 'lucide-react';
import { cn } from '@goodboy/ui';
import { DogMascot } from '../../../../shared/components/DogMascot';

export type CreateAgentTriggerVariant = 'tile' | 'compact';

const TILE_CLASS =
  'group flex items-center gap-2.5 rounded-lg border border-border-soft bg-elevated px-3 py-2.5 text-left shadow-sm transition-colors hover:border-border';
const COMPACT_CLASS =
  'inline-flex h-7 min-w-0 items-center gap-1.5 rounded-md border border-border-soft bg-elevated px-2 text-xs font-medium text-foreground shadow-sm transition-colors hover:border-border';

type Props = {
  readonly variant: CreateAgentTriggerVariant;
  readonly isOpen: boolean;
  readonly className?: string;
  readonly description?: string;
  readonly onClick: () => void;
};

export const CreateAgentTrigger = ({ variant, isOpen, className, description, onClick }: Props) => {
  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={cn(COMPACT_CLASS, className)}
      >
        <Plus size={13} aria-hidden className="shrink-0" />
        <span className="truncate">Create agent</span>
      </button>
    );
  }

  if (description == null) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={cn(TILE_CLASS, className)}
      >
        <DogMascot size={15} className="shrink-0 text-success" />
        <span className="min-w-0 truncate text-sm font-medium text-foreground">Create agent</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      className={cn(TILE_CLASS, className)}
    >
      <DogMascot size={16} className="shrink-0 text-success" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
        <span className="text-sm font-medium text-foreground">Create agent</span>
        <span className="truncate text-2xs text-muted-foreground">{description}</span>
      </span>
      <ArrowRight
        size={15}
        aria-hidden
        className="shrink-0 text-muted-foreground/30 motion-safe:transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground"
      />
    </button>
  );
};
