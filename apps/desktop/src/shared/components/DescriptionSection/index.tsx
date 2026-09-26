import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button, Markdown, Textarea, cn } from '@goodboy/ui';
import { useInlineProseEdit } from '../../hooks/useInlineProseEdit';
import { StudioWidget } from '@goodboy/ui';

type Props = {
  readonly text: string;
  readonly onSave?: ((next: string) => Promise<void>) | null;
};

const CLAMP_LINES = 10;
const CHARS_PER_LINE = 72;

type OverflowParams = {
  readonly text: string;
};

const overflowsClamp = ({ text }: OverflowParams): boolean =>
  text
    .split('\n')
    .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / CHARS_PER_LINE)), 0) >
  CLAMP_LINES;

export const DescriptionSection = ({ text, onSave }: Props) => {
  const edit = useInlineProseEdit({ value: text, onCommit: onSave });
  const [isExpanded, setIsExpanded] = useState(false);
  const isClamped = !isExpanded && overflowsClamp({ text });

  if (edit.isEditing) {
    return (
      <StudioWidget label="description" variant="frameless">
        <div className="flex flex-col gap-3">
          <Textarea
            autoFocus
            autoGrow
            minRows={8}
            maxRows={28}
            value={edit.draft}
            aria-label="Edit description"
            onChange={(event) => edit.setDraft(event.target.value)}
            onKeyDown={edit.onKeyDown}
            className="font-mono text-xs leading-relaxed"
          />
          <div className="flex items-center justify-between gap-3">
            {edit.error != null ? (
              <p role="alert" className="min-w-0 text-label text-danger">
                {edit.error}
              </p>
            ) : (
              <p className="text-secondary text-muted-foreground">Escape to cancel</p>
            )}
            <div className="flex shrink-0 items-center gap-2">
              <Button size="sm" variant="ghost" onClick={edit.cancel}>
                Cancel
              </Button>
              <Button
                size="sm"
                isBusy={edit.isSaving}
                busyLabel="Saving"
                onClick={() => void edit.commit()}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      </StudioWidget>
    );
  }

  return (
    <StudioWidget
      presentation="section"
      label="description"
      variant="frameless"
      action={
        edit.canEdit ? (
          <div className="flex items-center gap-2">
            {edit.isDirty ? (
              <span className="text-secondary text-warning">Unsaved edits</span>
            ) : null}
            <Button size="sm" variant="ghost" onClick={edit.start}>
              <Pencil size={12} aria-hidden />
              Edit
            </Button>
          </div>
        ) : undefined
      }
    >
      <div
        onClick={edit.start}
        className={cn('flex flex-col', edit.canEdit && 'cursor-text')}
        data-testid="description-body"
      >
        {text.trim() !== '' ? (
          <div className={cn('min-w-0', isClamped && 'line-clamp-[10] [&>*]:block')}>
            <Markdown text={text} className="text-prose" />
          </div>
        ) : (
          <p className="text-body italic text-faint-foreground">No description.</p>
        )}
      </div>
      {overflowsClamp({ text }) ? (
        <button
          type="button"
          onClick={() => setIsExpanded((expanded) => !expanded)}
          className="self-start text-secondary text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {isExpanded ? 'Show less' : 'Show more'}
        </button>
      ) : null}
    </StudioWidget>
  );
};
