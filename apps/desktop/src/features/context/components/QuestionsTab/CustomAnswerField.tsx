import { Plus } from 'lucide-react';
import { Textarea, cn } from '@goodboy/ui';

interface CustomAnswerFieldProps {
  value: string;
  open: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function CustomAnswerField({
  value,
  open,
  onToggle,
  onChange,
  placeholder = 'write your own answer…',
}: CustomAnswerFieldProps) {
  if (!open) {
    return (
      <button
        type="button"
        onClick={onToggle}
        title="add custom answer"
        className={cn(
          'inline-flex items-center gap-1 rounded-full border border-dashed border-border/40 px-2 py-0.5',
          'text-xs text-muted-foreground transition-colors',
          'hover:border-border hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        )}
      >
        <Plus size={10} />
        other
      </button>
    );
  }

  return (
    <div className="mt-1.5 flex w-full flex-col gap-1">
      <Textarea
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoGrow
        minRows={2}
        maxRows={6}
        className="text-xs"
      />
    </div>
  );
}
