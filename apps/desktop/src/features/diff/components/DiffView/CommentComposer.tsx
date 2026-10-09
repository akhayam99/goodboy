import { useEffect, useRef, useState } from 'react';
import { Button, Kbd, cn, tintClasses } from '@goodboy/ui';
import { PromptField } from '../../../../shared/components/PromptField';

type Props = {
  readonly label: string;
  readonly submitLabel: string;
  readonly initialBody?: string;
  readonly onSubmit: (body: string) => void;
  readonly onCancel: () => void;
  readonly onAskAgent?: (body: string) => void;
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
  const rootRef = useRef<HTMLDivElement | null>(null);
  const trimmed = body.trim();
  const submit = () => {
    if (trimmed.length > 0) {
      onSubmit(trimmed);
    }
  };

  useEffect(() => {
    rootRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, []);

  return (
    <div
      ref={rootRef}
      data-slot="diff-composer"
      className={cn(
        'flex flex-col gap-2 rounded-md border-l-2 bg-elevated px-3 py-3 font-sans',
        tintClasses('primary').rail,
      )}
    >
      <span className="text-chip text-muted-foreground">{label}</span>
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
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-auto flex items-center gap-1 text-meta text-faint-foreground">
          <Kbd look="inline">⌘↵</Kbd>
          <span>{submitLabel.toLowerCase()}</span>
          <span aria-hidden>·</span>
          <Kbd look="cap">esc</Kbd>
          <span>cancel</span>
        </span>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        {onAskAgent ? (
          <Button variant="secondary" size="sm" onClick={() => onAskAgent(trimmed)}>
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
