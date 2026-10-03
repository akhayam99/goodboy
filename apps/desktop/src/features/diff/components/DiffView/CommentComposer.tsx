import { useState } from 'react';
import { Button, KbdPill, cn, tintClasses } from '@goodboy/ui';
import { PromptField } from '../../../../shared/components/PromptField';

type Props = {
  readonly label: string;
  readonly submitLabel: string;
  readonly initialBody?: string;
  readonly onSubmit: (body: string) => void;
  readonly onCancel: () => void;
  readonly onAskAgent?: () => void;
};

export const CommentComposer = ({
  label,
  submitLabel,
  initialBody = '',
  onSubmit,
  onCancel,
  onAskAgent,
}: Props) => {
  const [body, setBody] = useState(initialBody);
  const trimmed = body.trim();
  const submit = () => {
    if (trimmed.length > 0) {
      onSubmit(trimmed);
    }
  };

  return (
    <div
      data-slot="diff-composer"
      className={cn(
        'flex flex-col gap-2 rounded-md border-l-2 bg-elevated px-3 py-2.5 font-sans',
        tintClasses('primary').rail,
      )}
    >
      <span className="text-secondary font-medium text-muted-foreground">{label}</span>
      <PromptField
        kind="document"
        autoFocus
        value={body}
        onChange={setBody}
        label={label}
        hasPreview
        minRows={2}
        maxRows={10}
        onSubmit={submit}
        className="bg-background"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            onCancel();
          }
        }}
      />
      <div className="flex items-center gap-1.5">
        <span className="mr-auto flex items-center gap-1 text-secondary text-faint-foreground">
          <KbdPill>⌘</KbdPill>
          <KbdPill>↵</KbdPill>
          <span>{submitLabel.toLowerCase()}</span>
          <span aria-hidden>·</span>
          <KbdPill>esc</KbdPill>
          <span>cancel</span>
        </span>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        {onAskAgent ? (
          <Button variant="secondary" size="sm" onClick={onAskAgent}>
            Ask agent
          </Button>
        ) : null}
        <Button size="sm" onClick={submit} disabled={trimmed.length === 0}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
};
