import { Pencil } from 'lucide-react';
import { Textarea, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';

type Props = {
  readonly value: string;
  readonly open: boolean;
  readonly onToggle: () => void;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
};

const ROW_FRAME = 'flex w-full min-w-0 rounded-md border px-2 py-1.5';

export const CustomAnswerField = ({
  value,
  open,
  onToggle,
  onChange,
  placeholder = 'write your own answer…',
}: Props) => {
  const filled = value.trim().length > 0;

  if (!open) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          ROW_FRAME,
          'items-center gap-2 border-border-soft text-left text-sm font-medium text-muted-foreground',
          'transition-[color,background-color,border-color] duration-150',
          'hover:border-border hover:bg-muted/40 hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        )}
      >
        <Pencil size={ICON_SIZE.row} aria-hidden className="shrink-0" />
        <span>other</span>
      </button>
    );
  }

  return (
    <div
      className={cn(
        ROW_FRAME,
        'flex-col gap-2 motion-safe:animate-fade-in',
        filled ? 'border-primary/40 bg-primary/10' : 'border-border-soft',
      )}
    >
      <span
        className={cn('text-2xs font-medium', filled ? 'text-primary' : 'text-muted-foreground')}
      >
        your answer
      </span>
      <Textarea
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoGrow
        minRows={1}
        maxRows={4}
        className="min-h-5 w-full resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 focus-visible:shadow-none"
      />
    </div>
  );
};
