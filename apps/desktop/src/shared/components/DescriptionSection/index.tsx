import { Pencil } from 'lucide-react';
import { Button, Markdown, Textarea, cn } from '@goodboy/ui';
import { useInlineProseEdit } from '../../hooks/useInlineProseEdit';
import { DetailSection } from '../StudioDetail';

type Props = {
  readonly text: string;
  readonly onSave?: ((next: string) => Promise<void>) | null;
};

export const DescriptionSection = ({ text, onSave }: Props) => {
  const edit = useInlineProseEdit({ value: text, onCommit: onSave });

  if (edit.isEditing) {
    return (
      <DetailSection label="description" variant="frameless">
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
              <p role="alert" className="min-w-0 text-xs text-danger">
                {edit.error}
              </p>
            ) : (
              <p className="text-2xs text-muted-foreground">Escape to cancel</p>
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
      </DetailSection>
    );
  }

  return (
    <DetailSection
      label="description"
      variant="frameless"
      action={
        edit.canEdit ? (
          <div className="flex items-center gap-2">
            {edit.isDirty ? <span className="text-2xs text-warning">Unsaved edits</span> : null}
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
          <Markdown text={text} className="text-sm leading-relaxed" />
        ) : (
          <p className="text-sm italic text-muted-foreground/60">No description.</p>
        )}
      </div>
    </DetailSection>
  );
};
