import { useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { Textarea } from '@goodboy/ui';

type Props = {
  onSubmit: (body: string) => void;
  onCancel: () => void;
  label?: string;
};

export const InlineComposer = ({ onSubmit, onCancel, label }: Props) => {
  const [body, setBody] = useState('');
  const trimmed = body.trim();
  return (
    <div className="flex gap-2 rounded-md border border-border-soft bg-background px-2 py-1.5">
      <MessageSquarePlus size={13} aria-hidden className="mt-0.5 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {label ? (
          <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
        ) : null}
        <Textarea
          autoFocus
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="note for the agent… (⌘↵ to save)"
          className="text-xs"
          autoGrow
          maxRows={6}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              onCancel();
            }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              if (trimmed.length > 0) {
                onSubmit(trimmed);
              }
            }
          }}
        />
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-sm px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => trimmed.length > 0 && onSubmit(trimmed)}
            disabled={trimmed.length === 0}
            className="inline-flex items-center gap-1 rounded-sm bg-foreground px-2 py-0.5 text-[10px] font-medium text-background hover:opacity-80 disabled:opacity-30"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};
