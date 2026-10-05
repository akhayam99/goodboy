import { useState } from 'react';
import { Button, useEscapeLayer } from '@goodboy/ui';
import { PromptField } from '../../../../shared/components/PromptField';

type Props = {
  readonly quote: string | null;
  readonly initialBody?: string;
  readonly submitLabel?: string;
  readonly onSubmit: (params: { readonly body: string }) => Promise<void>;
  readonly onCancel: () => void;
};

export const CommentComposer = ({
  quote,
  initialBody = '',
  submitLabel = 'Add comment',
  onSubmit,
  onCancel,
}: Props) => {
  const [body, setBody] = useState(initialBody);
  const [isBusy, setIsBusy] = useState(false);
  const isBlank = body.trim().length === 0;
  useEscapeLayer(onCancel);

  const submit = () => {
    if (isBlank || isBusy) {
      return;
    }
    setIsBusy(true);
    void onSubmit({ body }).finally(() => setIsBusy(false));
  };

  return (
    <div data-testid="plan-comment-composer" className="flex min-w-0 flex-col gap-2">
      {quote === null ? null : (
        <q className="block text-meta italic text-muted-foreground">{quote}</q>
      )}
      <PromptField
        kind="document"
        autoFocus
        label="Comment for the planner"
        placeholder="Write a comment for the planner"
        value={body}
        onChange={setBody}
        onSubmit={submit}
        minRows={2}
        maxRows={8}
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" disabled={isBlank} isBusy={isBusy} onClick={submit}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
};
