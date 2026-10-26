import { useRef, useState, type ReactNode } from 'react';
import { Button, cn, useEscapeLayer } from '@goodboy/ui';
import { PromptField } from '../PromptField';
import { useFocusReturn } from '../../hooks/useFocusReturn';

export type CommentComposerBody = {
  readonly body: string;
};

type Props = {
  readonly label: string;
  readonly submitLabel: string;
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly onSubmit: (params: CommentComposerBody) => void | Promise<void>;
  readonly onCancel: () => void;
  readonly onAskAgent?: (params: CommentComposerBody) => void;
  readonly lead?: ReactNode;
  readonly placeholder?: string;
  readonly cancelLabel?: string;
  readonly isEmptyAllowed?: boolean;
  readonly isBusy?: boolean;
  readonly error?: string | null;
  readonly testId?: string;
  readonly className?: string;
};

const ESCAPE_HINT = 'Esc cancels';

export const CommentComposer = ({
  label,
  submitLabel,
  value,
  onChange,
  onSubmit,
  onCancel,
  onAskAgent,
  lead,
  placeholder,
  cancelLabel = 'Cancel',
  isEmptyAllowed = false,
  isBusy = false,
  error = null,
  testId,
  className,
}: Props) => {
  const [isPending, setIsPending] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const body = value.trim();
  const isBlocked = body === '' && !isEmptyAllowed;
  const isWorking = isBusy || isPending;
  useEscapeLayer(onCancel);
  useFocusReturn({ rootRef });

  const submit = (): void => {
    if (isBlocked || isWorking) {
      return;
    }
    const result = onSubmit({ body });
    if (!(result instanceof Promise)) {
      return;
    }
    setIsPending(true);
    void result.finally(() => setIsPending(false));
  };

  return (
    <div
      ref={rootRef}
      data-slot="comment-composer"
      data-testid={testId}
      className={cn('flex min-w-0 flex-col gap-2', className)}
    >
      {lead}
      <PromptField
        kind="document"
        autoFocus
        hasPreview
        hasChangedKeys
        label={label}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onSubmit={submit}
        keyLabels={{ send: submitLabel.toLowerCase() }}
        isSubmitBlocked={isBlocked}
        minRows={2}
        maxRows={12}
      />
      {error === null ? null : (
        <p role="alert" className="text-meta text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="min-w-0 flex-1 text-meta text-faint-foreground">{ESCAPE_HINT}</span>
        <Button variant="ghost" size="sm" disabled={isWorking} onClick={onCancel}>
          {cancelLabel}
        </Button>
        {onAskAgent === undefined ? null : (
          <Button variant="secondary" size="sm" onClick={() => onAskAgent({ body })}>
            Ask agent
          </Button>
        )}
        <Button
          variant="primary"
          size="sm"
          disabled={isBlocked}
          isBusy={isWorking}
          onClick={submit}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
};
