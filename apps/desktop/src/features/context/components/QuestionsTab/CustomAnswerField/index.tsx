import { Pencil } from 'lucide-react';
import { Textarea, cn } from '@goodboy/ui';

type Props = {
  value: string;
  open: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function CustomAnswerField({
  value,
  open,
  onToggle,
  onChange,
  placeholder = 'write your own answer…',
}: Props) {
  if (!open) {
    return (
      <button
        type="button"
        onClick={onToggle}
        title="add custom answer"
        className={cn(
          'inline-flex items-center gap-1 rounded-full border border-dashed border-border/50 px-2.5 py-1',
          'text-xs text-muted-foreground transition-all duration-150',
          'hover:border-primary/50 hover:bg-primary/5 hover:text-primary active:scale-[0.97]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        )}
      >
        <Pencil size={10} />
        other
      </button>
    );
  }

  return (
    <div className="mt-1 flex w-full flex-col gap-1 motion-safe:animate-fade-in">
      <span className="px-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
        your answer
      </span>
      <Textarea
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoGrow
        minRows={2}
        maxRows={6}
        className="rounded-md text-xs"
      />
    </div>
  );
}
