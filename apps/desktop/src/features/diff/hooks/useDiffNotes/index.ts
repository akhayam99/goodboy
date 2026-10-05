import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useAskAgent } from '../useAskAgent';
import { useNoteFixes } from '../useNoteFixes';
import { NOTE_LOCK_REASON, type NoteFix } from '../../lib/noteFixes';
import type { DiffComments, DiffThread } from '../../components/DiffView/types';

type Params = {
  readonly sessionId: SessionId;
};

export type DiffNotes = {
  readonly comments: DiffComments;
  readonly fixes: ReadonlyArray<NoteFix>;
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
    createdAt: note.createdAt,
    statusLabel: fix.word,
    isResolved: isDone,
    canEdit: false,
    canClose: !isDone,
    canReopen: fix.canReopen,
    actions: [],
    lockReason: fix.isLocked ? NOTE_LOCK_REASON : null,
    meta: fix.group === 'open' ? null : fix.run,
  };
};

export const useDiffNotes = ({ sessionId }: Params): DiffNotes => {
  const fixes = useNoteFixes({ sessionId });
  const addDiffComment = useAppStore((s) => s.addDiffComment);
  const closeResolvedNote = useAppStore((s) => s.closeResolvedNote);
  const reopenDiffComment = useAppStore((s) => s.reopenDiffComment);
  const deleteDiffComment = useAppStore((s) => s.deleteDiffComment);
  const askAgent = useAskAgent({ sessionId });

  const comments = useMemo<DiffComments>(() => {
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
      onDelete: (id) => void deleteDiffComment(sessionId, id),
    };
  }, [
    addDiffComment,
    askAgent,
    closeResolvedNote,
    deleteDiffComment,
    fixes,
    reopenDiffComment,
    sessionId,
  ]);

  return { comments, fixes };
};
