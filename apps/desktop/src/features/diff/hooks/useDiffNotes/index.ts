import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { CHECK_STATE, NOTHING_CHANGED } from '../../../../store/slices/notifications/errorRecovery';
import { useShowToast } from '../../../../shared/components/Toast/useShowToast';
import { NAMES } from '../../../../shared/utils/names';
import { useAskAgent } from '../useAskAgent';
import { useNoteFixes } from '../useNoteFixes';
import { NOTE_LOCK_REASON, type NoteFix } from '../../lib/noteFixes';
import type { DiffComments, DiffThread } from '../../components/DiffView/types';

type Params = {
  readonly sessionId: SessionId;
};

type ThreadParams = {
  readonly fix: NoteFix;
  readonly sessionId: SessionId;
};

const threadOf = ({ fix, sessionId }: ThreadParams): DiffThread => {
  const { note } = fix;
  const isDone = fix.isClosed || fix.group === 'done';
  return {
    id: note.id,
    filePath: note.filePath,
    anchor: note.anchor ?? null,
    body: note.body,
    tone: fix.tone,
    author: 'You',
    isAgent: false,
    source: 'note',
    host: null,
    createdAt: note.createdAt,
    statusLabel: fix.word,
    isResolved: isDone,
    fixTarget: { sessionId, threadId: fix.threadId },
    canEdit: !isDone && !fix.isLocked,
    canRestore: true,
    canClose: !isDone,
    canReopen: fix.canReopen,
    actions: [],
    lockReason: fix.isLocked ? NOTE_LOCK_REASON : null,
    meta: fix.group === 'open' ? null : fix.run,
  };
};

export const useDiffNotes = ({ sessionId }: Params): DiffComments => {
  const fixes = useNoteFixes({ sessionId });
  const addDiffComment = useAppStore((s) => s.addDiffComment);
  const closeResolvedNote = useAppStore((s) => s.closeResolvedNote);
  const reopenDiffComment = useAppStore((s) => s.reopenDiffComment);
  const editDiffComment = useAppStore((s) => s.editDiffComment);
  const deleteDiffComment = useAppStore((s) => s.deleteDiffComment);
  const restoreDiffComment = useAppStore((s) => s.restoreDiffComment);
  const reportError = useAppStore((s) => s.reportError);
  const askAgent = useAskAgent({ sessionId });
  const showToast = useShowToast();

  return useMemo<DiffComments>(() => {
    const threadIdOf = new Map(fixes.map((fix) => [fix.note.id, fix.threadId] as const));
    return {
      threads: fixes.map((fix) => threadOf({ fix, sessionId })),
      submitLabel: NAMES.addComment,
      composerLabel: 'Comment',
      allowFileLevel: true,
      onSubmit: (filePath, anchor, body) =>
        void addDiffComment(sessionId, filePath, body, anchor ?? undefined).catch(
          (error: unknown) =>
            reportError({
              recovery: CHECK_STATE,
              title: "Couldn't save the comment",
              error,
              sessionId,
            }),
        ),
      onAskAgent: askAgent,
      onClose: (id) => {
        const threadId = threadIdOf.get(id);
        if (threadId === undefined) {
          return;
        }
        void closeResolvedNote({ sessionId, threadId });
      },
      onReopen: (id) =>
        void reopenDiffComment(sessionId, id).catch((error: unknown) =>
          reportError({
            recovery: NOTHING_CHANGED,
            title: "Couldn't reopen the comment",
            error,
            sessionId,
          }),
        ),
      onEdit: (id, body) => editDiffComment(sessionId, id, body),
      onDelete: (id) => {
        const note = fixes.find((fix) => fix.note.id === id)?.note;
        void deleteDiffComment(sessionId, id).then(
          () => {
            if (note === undefined) {
              return;
            }
            useAppStore.getState().undoable({
              showToast,
              title: 'Comment deleted',
              message: note.body,
              undo: async () => {
                await restoreDiffComment({ note });
              },
            });
          },
          (error: unknown) =>
            reportError({
              recovery: CHECK_STATE,
              title: "Couldn't delete the comment",
              error,
              sessionId,
            }),
        );
      },
    };
  }, [
    addDiffComment,
    askAgent,
    closeResolvedNote,
    deleteDiffComment,
    editDiffComment,
    fixes,
    reopenDiffComment,
    reportError,
    restoreDiffComment,
    sessionId,
    showToast,
  ]);
};
