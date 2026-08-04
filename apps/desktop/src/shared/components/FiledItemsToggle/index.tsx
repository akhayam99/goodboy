import type { LucideIcon } from 'lucide-react';
import { cn } from '@goodboy/ui';

type Props = {
  readonly noun: string;
  readonly items: string;
  readonly count: number;
  readonly isShown: boolean;
  readonly icon: LucideIcon;
  readonly onChange: (isShown: boolean) => void;
};

export const FiledItemsToggle = ({ noun, items, count, isShown, icon, onChange }: Props) => {
  if (count === 0) {
    return null;
  }

  const Icon = icon;
  const action = isShown ? 'Hide' : 'Show';

  return (
    <div className="flex justify-center pt-1">
      <button
        type="button"
        onClick={() => onChange(!isShown)}
        aria-pressed={isShown}
        title={`${action.toLowerCase()} the ${count} ${noun} ${items}`}
        className={cn(
          'flex h-7 items-center gap-1.5 rounded-md px-2 text-2xs font-medium transition-colors',
          isShown
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground',
        )}
      >
        <Icon size={10} aria-hidden />
        {action} {noun} ({count})
      </button>
    </div>
  );
};
