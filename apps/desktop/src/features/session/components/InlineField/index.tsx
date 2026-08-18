import { Pencil } from 'lucide-react';
import { cn, Tooltip } from '@goodboy/ui';

type Props = {
  label: string;
  children: React.ReactNode;
  onEdit?: () => void;
  editLabel?: string;
};

export const InlineField = ({ label, children, onEdit, editLabel }: Props) => {
  return (
    <div className="group/inline flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground/70">
          {label}
        </span>
        {onEdit ? (
          <Tooltip content={editLabel ?? `Edit ${label}`}>
            <button
              type="button"
              onClick={onEdit}
              aria-label={editLabel ?? `edit ${label}`}
              className={cn(
                'inline-flex size-4 items-center justify-center rounded text-muted-foreground/50',
                'opacity-0 transition-[opacity,color,background-color] hover:bg-muted hover:text-foreground',
                'focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]',
                'group-hover/inline:opacity-100 motion-reduce:opacity-60',
              )}
            >
              <Pencil size={10} aria-hidden />
            </button>
          </Tooltip>
        ) : null}
      </div>
      {children}
    </div>
  );
};
