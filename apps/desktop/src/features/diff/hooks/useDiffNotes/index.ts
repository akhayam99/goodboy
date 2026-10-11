import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useShowToast } from '../../../../shared/components/Toast/useShowToast';
import { useAskAgent } from '../useAskAgent';
import { useNoteFixes } from '../useNoteFixes';
import { NOTE_LOCK_REASON, type NoteFix } from '../../lib/noteFixes';
import type { DiffComments, DiffThread } from '../../components/DiffView/types';

type Params = {
  readonly sessionId: SessionId;
};

const threadOf = ({ fix }: { readonly fix: NoteFix }): DiffThread => {
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
  const askAgent = useAskAgent({ sessionId });
  const showToast = useShowToast();

  return useMemo<DiffComments>(() => {
    const threadIdOf = new Map(fixes.map((fix) => [fix.note.id, fix.threadId] as const));
    return {
      threads: fixes.map((fix) => threadOf({ fix })),
      submitLabel: 'Add note',
      composerLabel: 'Note',
      noun: 'note',
      allowFileLevel: true,
      onSubmit: (filePath, anchor, body) =>
        void addDiffComment(sessionId, filePath, body, anchor ?? undefined),
      onAskAgent: askAgent,
      onClose: (id) => {
        const threadId = threadIdOf.get(id);
        if (threadId === undefined) {
          return;
        }
        void closeResolvedNote({ sessionId, threadId });
      },
      onReopen: (id) => void reopenDiffComment(sessionId, id),
      onEdit: (id, body) => void editDiffComment(sessionId, id, body),
      onDelete: (id) => {
        const note = fixes.find((fix) => fix.note.id === id)?.note;
        void deleteDiffComment(sessionId, id).then(() => {
          if (note === undefined) {
            return;
          }
          useAppStore.getState().undoable({
            showToast,
            title: 'Note deleted',
            message: note.body,
            undo: async () => {
              await addDiffComment(sessionId, note.filePath, note.body, note.anchor ?? undefined);
            },
          });
        });
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
    sessionId,
    showToast,
  ]);
};
