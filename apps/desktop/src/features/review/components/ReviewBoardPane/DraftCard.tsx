import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Textarea, cn } from '@goodboy/ui';
import type { PrReviewDraft } from '@goodboy/types';
import { ComposerActionRow } from './ComposerActionRow';

type Props = {
  readonly draft: PrReviewDraft;
  readonly onEdit: (body: string) => void;
  readonly onDiscard: () => void;
};

export const DraftCard = ({ draft, onEdit, onDiscard }: Props) => {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(draft.body);
  const trimmed = body.trim();

  const startEditing = () => {
    setBody(draft.body);
    setEditing(true);
  };

  const save = () => {
    if (trimmed.length === 0) {
      return;
    }
    onEdit(trimmed);
    setEditing(false);
  };

  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 rounded-md border-l-2 bg-muted/20 px-3 py-2',
        draft.stale ? 'border-warning/70 opacity-70' : 'border-indigo-400/70',
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className="min-w-0 truncate font-mono text-2xs text-muted-foreground">
          {draft.path}:{draft.line}
        </span>
        <span
          className={cn(
            'shrink-0 rounded-full px-1.5 py-0.5 text-3xs font-medium',
            draft.origin === 'agent'
              ? 'bg-indigo-400/15 text-indigo-600'
              : 'bg-muted text-muted-foreground',
          )}
        >
          {draft.origin === 'agent' ? 'Agent' : 'You'}
        </span>
        {draft.stale ? (
          <span
            title="the diff changed under this comment; it will be skipped on publish"
            className="shrink-0 rounded-full bg-warning/15 px-1.5 py-0.5 text-3xs font-medium text-warning"
          >
            Stale
          </span>
        ) : null}
        <span className="flex-1" />
        <button
          type="button"
          onClick={onDiscard}
          title="discard draft"
          aria-label={`discard draft on ${draft.path}:${draft.line}`}
          className="flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-danger"
        >
          <Trash2 size={11} aria-hidden />
        </button>
      </div>
      {editing ? (
        <div className="flex flex-col gap-1">
          <Textarea
            autoFocus
            value={body}
            onChange={(event) => setBody(event.target.value)}
            aria-label="Edit draft comment"
            className="text-xs"
            autoGrow
            maxRows={8}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                setEditing(false);
              }
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                save();
              }
            }}
          />
          <ComposerActionRow
            saveLabel="Save"
            disabled={trimmed.length === 0}
            onCancel={() => setEditing(false)}
            onSave={save}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={startEditing}
          title="edit draft"
          className="whitespace-pre-wrap rounded-sm text-left text-xs leading-relaxed text-foreground/85 transition-colors hover:bg-muted/40"
        >
          {draft.body}
        </button>
      )}
    </div>
  );
};
