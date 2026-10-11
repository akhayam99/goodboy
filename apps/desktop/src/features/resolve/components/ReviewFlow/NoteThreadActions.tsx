import { useState } from 'react';
import { REVIEW_SOURCE_LABEL } from '@goodboy/core';
import { Button, formatError } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { isReportedError } from '../../../../store/slices/notifications/reportedError';
import { resolveReviewTarget } from '../../../../store/slices/review-drafts/resolveReviewTarget';
import { useActionEnv } from '../../../actions/useActionEnv';
import { useActiveReviewSource } from '../../hooks/useActiveReviewSource';
import { isOpenNote, noteIdOfThread, noteThreadId } from '../../notes/noteThread';
import { postNotesResultMessage, postNotesToPr } from '../../notes/postNotesToPr';
import type { ReviewEntry } from './useReviewEntries';

type Props = {
  readonly sessionId: SessionId;
  readonly entry: ReviewEntry;
};

export const NoteThreadActions = ({ sessionId, entry }: Props) => {
  const env = useActionEnv({ origin: 'button' });
  const { source } = useActiveReviewSource({ sessionId });
  const noteId = entry.row.thread.diffCommentId ?? noteIdOfThread({ threadId: entry.threadId });
  const note = useAppStore((s) =>
    noteId === null
      ? null
      : ((s.diffComments[sessionId] ?? []).find((candidate) => candidate.id === noteId) ?? null),
  );
  const hasTarget = useAppStore((s) => resolveReviewTarget({ state: s, sessionId }) !== null);
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
  const canPost = hasTarget && isOpenNote({ note });
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      {canPost ? (
        <Button
          size="sm"
          variant="ghost"
          disabled={isBusy}
          onClick={() =>
            void run(async () => {
              const target = resolveReviewTarget({ state: useAppStore.getState(), sessionId });
              if (target === null) {
                return;
              }
              const result = await postNotesToPr({
                sessionId,
                target,
                notes: [note],
                addReviewDraft,
                closeNote: (id) =>
                  closeResolvedNote({ sessionId, threadId: noteThreadId({ noteId: id }) }),
              });
              env.showToast({ kind: 'success', message: postNotesResultMessage(result) });
            })
          }
        >
          Post to {source === null ? 'GitHub' : REVIEW_SOURCE_LABEL[source.kind]}
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
