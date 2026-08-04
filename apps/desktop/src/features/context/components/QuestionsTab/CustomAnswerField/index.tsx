import { Pencil } from 'lucide-react';
import { Textarea, cn } from '@goodboy/ui';

type Props = {
  value: string;
  open: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
  placeholder?: string;
};

export const CustomAnswerField = ({
  value,
  open,
  onToggle,
  onChange,
  placeholder = 'write your own answer…',
}: Props) => {
  if (!open) {
    return (
      <button
        type="button"
        onClick={onToggle}
        title="Add custom answer"
        className={cn(
          'inline-flex items-center gap-1 rounded-full border border-dashed border-border/60 px-2.5 py-1',
          'text-xs text-muted-foreground transition-[color,background-color,border-color,transform] duration-150',
          'hover:border-border hover:bg-muted hover:text-foreground active:scale-[0.97]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        )}
      >
        <Pencil size={10} />
        other
      </button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 motion-safe:animate-fade-in">
      <span className="px-0.5 text-2xs font-medium text-muted-foreground">your answer</span>
      <Textarea
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoGrow
        minRows={2}
        maxRows={6}
        className="rounded-md border-border-soft bg-subtle text-xs shadow-none"
      />
    </div>
  );
};
