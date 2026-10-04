import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { Button, Chip, IconButton, Markdown, Textarea, formatError } from '@goodboy/ui';
import type { PrReviewDraft, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { isReportedError } from '../../../../../store/slices/notifications/reportedError';
import { useActionEnv } from '../../../../actions/useActionEnv';
import { useObjectActions } from '../../../../actions/useObjectActions';
import { WRITE_REVIEW_EDIT_EVENT, isDraftEditRequest } from '../../../writeReviewRequest';

type Props = {
  readonly sessionId: SessionId;
  readonly draft: PrReviewDraft;
};

const STALE_HINT = 'The diff changed under this comment; it is skipped on submit';

export const LineComment = ({ sessionId, draft }: Props) => {
  const target = useMemo(
    () => ({ kind: 'writeReview' as const, sessionId, draftId: draft.id }),
    [draft.id, sessionId],
  );
  const env = useActionEnv({ origin: 'button' });
  const { actions, run } = useObjectActions({ target, env });
  const updateReviewDraft = useAppStore((s) => s.updateReviewDraft);
  const [isEditing, setIsEditing] = useState(false);
  const [body, setBody] = useState(draft.body);
  const [error, setError] = useState<string | null>(null);
  const hover = actions.filter((action) => action.slot === 'hover');

  useEffect(() => {
    const onRequest = (event: Event): void => {
      if (!isDraftEditRequest(event) || event.detail.draftId !== draft.id) {
        return;
      }
      setBody(draft.body);
      setIsEditing(true);
    };
    window.addEventListener(WRITE_REVIEW_EDIT_EVENT, onRequest);
    return () => window.removeEventListener(WRITE_REVIEW_EDIT_EVENT, onRequest);
  }, [draft.body, draft.id]);

  const save = (): void => {
    const trimmed = body.trim();
    if (trimmed === '') {
      return;
    }
    setIsEditing(false);
    void updateReviewDraft(draft.id, trimmed).catch((caught: unknown) =>
      setError(formatError(caught)),
    );
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setIsEditing(false);
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      save();
    }
  };

  const press = (actionId: string): void => {
    setError(null);
    void run({ actionId }).catch((caught: unknown) => {
      if (!isReportedError(caught)) {
        setError(formatError(caught));
      }
    });
  };

  return (
    <li className="group/line-comment flex min-w-0 list-none flex-col gap-2 rounded-lg bg-subtle px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 truncate font-mono text-meta text-muted-foreground">
          {draft.path}:{draft.line}
        </span>
        {draft.stale && <Chip tone="warning" size="3xs" label="Stale" title={STALE_HINT} />}
        {!isEditing && (
          <span className="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 group-focus-within/line-comment:opacity-100 group-hover/line-comment:opacity-100 motion-safe:transition-opacity">
            {hover.map((action) => (
              <IconButton
                key={action.id}
                icon={action.icon}
                label={action.label}
                variant="ghost"
                onClick={() => press(action.id)}
              />
            ))}
          </span>
        )}
      </div>
      {isEditing ? (
        <div className="flex min-w-0 flex-col gap-2">
          <Textarea
            aria-label="Edit comment"
            value={body}
            autoFocus
            autoGrow
            minRows={2}
            maxRows={10}
            className="text-body"
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={onKeyDown}
          />
          <div className="flex items-center justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" disabled={body.trim() === ''} onClick={save}>
              Save
            </Button>
          </div>
        </div>
      ) : (
        <Markdown text={draft.body} variant="preview" className="text-body text-foreground" />
      )}
      {error !== null && <p className="text-meta text-danger">{error}</p>}
    </li>
  );
};
