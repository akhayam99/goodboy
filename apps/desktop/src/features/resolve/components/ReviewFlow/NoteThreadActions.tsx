import { useState } from 'react';
import { REVIEW_SOURCE_LABEL } from '@goodboy/core/review-source';
import { Button, formatError } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { isReportedError } from '../../../../store/slices/notifications/reportedError';
import { selectDisplayedMount } from '../../../../store/slices/project-mounts/selectors';
import { mountReviewOf } from '../../../review/mountReviewOf';
import { useActionEnv } from '../../../actions/useActionEnv';
import { isOpenNote, noteIdOfThread, noteThreadId } from '../../notes/noteThread';
import { postNotesResultMessage, postNotesToPr } from '../../notes/postNotesToPr';
import type { ReviewEntry } from './useReviewEntries';

type Props = {
  readonly sessionId: SessionId;
  readonly entry: ReviewEntry;
};

export const NoteThreadActions = ({ sessionId, entry }: Props) => {
  const env = useActionEnv({ origin: 'button' });
  const noteId = entry.row.thread.diffCommentId ?? noteIdOfThread({ threadId: entry.threadId });
  const note = useAppStore((s) =>
    noteId === null
      ? null
      : ((s.diffComments[sessionId] ?? []).find((candidate) => candidate.id === noteId) ?? null),
  );
  const mountId = useAppStore(
    (s) => selectDisplayedMount({ state: s, sessionId })?.mountId ?? null,
  );
  const reviewTarget = useAppStore((state) => mountReviewOf({ state, sessionId, mountId }).target);
  const addReviewDraft = useAppStore((s) => s.addReviewDraft);
  const closeResolvedNote = useAppStore((s) => s.closeResolvedNote);
  const discardDiffComments = useAppStore((s) => s.discardDiffComments);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (note === null) {
    return null;
  }
  const run = async (action: () => Promise<void>): Promise<void> => {
    setIsBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      if (!isReportedError(caught)) {
        setError(formatError(caught));
      }
    } finally {
      setIsBusy(false);
    }
  };
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {reviewTarget !== null && isOpenNote({ note }) ? (
        <Button
          size="sm"
          variant="ghost"
          disabled={isBusy}
          onClick={() =>
            void run(async () => {
              const result = await postNotesToPr({
                sessionId,
                target: reviewTarget,
                notes: [note],
                addReviewDraft,
                closeNote: (id) =>
                  closeResolvedNote({ sessionId, threadId: noteThreadId({ noteId: id }) }),
              });
              env.showToast({ kind: 'success', message: postNotesResultMessage(result) });
            })
          }
        >
          Post to {REVIEW_SOURCE_LABEL[reviewTarget.provider]}
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="ghost"
        disabled={isBusy}
        onClick={() => void run(() => discardDiffComments({ sessionId, ids: [note.id] }))}
      >
        Delete
      </Button>
      {error === null ? null : (
        <p role="alert" className="text-meta text-danger">
          {error}
        </p>
      )}
    </div>
  );
};
