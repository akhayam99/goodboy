import { useEffect, useMemo, useState } from 'react';
import { Chip, IconButton, Markdown, formatError } from '@goodboy/ui';
import type { PrReviewDraft, SessionId } from '@goodboy/types';
import {
  CommentComposer,
  type CommentComposerBody,
} from '../../../../shared/components/CommentComposer';
import { useAppStore } from '../../../../store';
import { isReportedError } from '../../../../store/slices/notifications/reportedError';
import { useActionEnv } from '../../../actions/useActionEnv';
import { useObjectActions } from '../../../actions/useObjectActions';
import { WRITE_REVIEW_EDIT_EVENT, isDraftEditRequest } from '../../writeReviewRequest';

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

  const save = ({ body: saved }: CommentComposerBody): void => {
    setIsEditing(false);
    void updateReviewDraft(draft.id, saved).catch((caught: unknown) =>
      setError(formatError(caught)),
    );
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
        {draft.stale && <Chip kind="state" tone="warning" label="Stale" title={STALE_HINT} />}
        {!isEditing && (
          <span className="ml-auto flex shrink-0 items-center gap-0.5">
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
        <CommentComposer
          label="Edit comment"
          submitLabel="Save"
          value={body}
          onChange={setBody}
          onSubmit={save}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <Markdown text={draft.body} variant="preview" className="text-body text-foreground" />
      )}
      {error !== null && <p className="text-meta text-danger">{error}</p>}
    </li>
  );
};
