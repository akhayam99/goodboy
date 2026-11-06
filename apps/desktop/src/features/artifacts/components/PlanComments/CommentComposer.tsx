import { useState } from 'react';
import { formatError } from '@goodboy/ui';
import {
  CommentComposer as SharedCommentComposer,
  type CommentComposerBody,
} from '../../../../shared/components/CommentComposer';

type Props = {
  readonly quote: string | null;
  readonly initialBody?: string;
  readonly submitLabel?: string;
  readonly onSubmit: (params: CommentComposerBody) => Promise<void>;
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
  const [error, setError] = useState<string | null>(null);

  const save = async ({ body: text }: CommentComposerBody): Promise<void> => {
    setError(null);
    try {
      await onSubmit({ body: text });
    } catch (cause) {
      setError(formatError(cause));
    }
  };

  return (
    <SharedCommentComposer
      testId="plan-comment-composer"
      label="Comment for the planner"
      placeholder="Write a comment for the planner"
      submitLabel={submitLabel}
      value={body}
      onChange={setBody}
      onSubmit={save}
      onKeep={initialBody === '' ? save : undefined}
      onCancel={onCancel}
      error={error}
      lead={
        quote === null ? null : (
          <q className="block text-meta italic text-muted-foreground">{quote}</q>
        )
      }
    />
  );
};
