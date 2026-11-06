import { useEffect, useRef, useState } from 'react';
import { formatError } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
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

type ChangeParams = Readonly<{ next: string }>;

export const CommentComposer = ({
  quote,
  initialBody = '',
  submitLabel = 'Add comment',
  onSubmit,
  onCancel,
}: Props) => {
  const [body, setBody] = useState(initialBody);
  const [error, setError] = useState<string | null>(null);
  const typed = useRef(initialBody);
  const isHandled = useRef(false);
  const latest = useRef({ onSubmit, canKeep: initialBody === '' });
  latest.current = { onSubmit, canKeep: initialBody === '' };

  useEffect(() => {
    const flush = (): void => {
      const text = typed.current.trim();
      if (isHandled.current || !latest.current.canKeep || text === '') {
        return;
      }
      isHandled.current = true;
      void latest.current.onSubmit({ body: text }).catch((cause: unknown) => {
        void useAppStore.getState().reportError({
          title: "Couldn't save the comment",
          error: cause,
        });
      });
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);

  const change = ({ next }: ChangeParams): void => {
    typed.current = next;
    setBody(next);
  };

  const cancel = (): void => {
    isHandled.current = true;
    onCancel();
  };

  const save = async ({ body: text }: CommentComposerBody): Promise<void> => {
    setError(null);
    isHandled.current = true;
    try {
      await onSubmit({ body: text });
    } catch (cause) {
      isHandled.current = false;
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
      onChange={(next) => change({ next })}
      onSubmit={save}
      onKeep={initialBody === '' ? save : undefined}
      onCancel={cancel}
      error={error}
      lead={
        quote === null ? null : (
          <q className="block text-meta italic text-muted-foreground">{quote}</q>
        )
      }
    />
  );
};
