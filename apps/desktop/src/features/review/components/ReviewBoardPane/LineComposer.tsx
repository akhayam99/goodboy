import { useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { Textarea } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly onSubmit: (body: string) => void;
  readonly onCancel: () => void;
};

export const LineComposer = ({ label, onSubmit, onCancel }: Props) => {
  const [body, setBody] = useState('');
  const trimmed = body.trim();
  return (
    <div className="flex gap-2">
      <MessageSquarePlus size={13} aria-hidden className="shrink-0 text-indigo-500" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
        <Textarea
          autoFocus
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Draft a review comment… (⌘↵ to add)"
          aria-label="Draft comment body"
          className="text-xs"
          autoGrow
          maxRows={6}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              onCancel();
            }
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
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
            Add draft
          </button>
        </div>
      </div>
    </div>
  );
};
