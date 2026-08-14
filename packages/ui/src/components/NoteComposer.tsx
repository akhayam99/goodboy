import { useState } from 'react';
import { formatError } from '../formatError';
import { Button } from './Button';
import { Textarea } from './Textarea';

type Props = {
  readonly placeholder: string;
  readonly submitLabel: string;
  readonly minRows?: number;
  readonly hint?: string;
  readonly onSubmit: (body: string) => Promise<void>;
};

export const NoteComposer = ({
  placeholder,
  submitLabel,
  minRows = 3,
  hint = 'Markdown supported',
  onSubmit,
}: Props) => {
  const [draft, setDraft] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const body = draft.trim();

  const submit = async () => {
    if (body === '') {
      return;
    }
    setIsPosting(true);
    setError(null);
    try {
      await onSubmit(body);
      setDraft('');
    } catch (postError: unknown) {
      setError(formatError(postError));
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        autoGrow
        minRows={minRows}
        maxRows={16}
        value={draft}
        aria-label={placeholder}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        className="text-sm leading-relaxed"
      />
      <div className="flex items-center justify-between gap-3">
        {error != null ? (
          <p role="alert" className="min-w-0 text-xs text-danger">
            {error}
          </p>
        ) : (
          <p className="text-2xs text-muted-foreground">{hint}</p>
        )}
        <Button
          size="sm"
          disabled={body === ''}
          isBusy={isPosting}
          busyLabel="Posting"
          onClick={() => void submit()}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
};
