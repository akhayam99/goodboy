import { useMemo } from 'react';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore, agentPlace } from '../../../../store';
import { openReview } from '../../../review/openReview';
import { useAskAgent } from '../useAskAgent';
import { useNoteFixes } from '../useNoteFixes';
import { NOTE_LOCK_REASON, type NoteFix } from '../../lib/noteFixes';
import { NOTE_ACTION_LABEL } from '../../diffNotesCopy';
import type { DiffComments, DiffThread, DiffThreadAction } from '../../components/DiffView/types';

type Params = {
  readonly sessionId: SessionId;
};

export type DiffNotes = {
  readonly comments: DiffComments;
  readonly fixes: ReadonlyArray<NoteFix>;
};

type ActionHandlers = {
  readonly onFix: (fix: NoteFix) => void;
  readonly onOpenBrief: (agentId: AgentId) => void;
  readonly onOpenInReview: (fix: NoteFix) => void;
};

const actionsOf = ({
  fix,
  handlers,
}: {
  readonly fix: NoteFix;
  readonly handlers: ActionHandlers;
}): ReadonlyArray<DiffThreadAction> => {
  const actions: Array<DiffThreadAction> = [];
  if (fix.canFix) {
    actions.push({
      id: 'fix',
      label: NOTE_ACTION_LABEL.fix,
      isPrimary: true,
      onClick: () => handlers.onFix(fix),
    });
  }
  if (fix.group === 'ready') {
    actions.push({
      id: 'review',
      label: NOTE_ACTION_LABEL.openInReview,
      isPrimary: false,
      onClick: () => handlers.onOpenInReview(fix),
    });
  }
  const { agentId } = fix;
  const isBriefShown =
    fix.group === 'working' || fix.group === 'needs' || (fix.group === 'done' && !fix.canReopen);
  if (agentId !== null && isBriefShown) {
    actions.push({
      id: 'brief',
      label: NOTE_ACTION_LABEL.openBrief,
      isPrimary: false,
      onClick: () => handlers.onOpenBrief(agentId),
    });
  }
  return actions;
};

const threadOf = ({
  fix,
  handlers,
}: {
  readonly fix: NoteFix;
  readonly handlers: ActionHandlers;
}): DiffThread => {
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
    actions: actionsOf({ fix, handlers }),
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
  const showDiffNoteLaunch = useAppStore((s) => s.showDiffNoteLaunch);
  const navigate = useAppStore((s) => s.navigate);
  const askAgent = useAskAgent({ sessionId });

  const comments = useMemo<DiffComments>(() => {
    const handlers: ActionHandlers = {
      onFix: (fix) => showDiffNoteLaunch({ sessionId, threadIds: [fix.threadId] }),
      onOpenBrief: (agentId) => navigate({ to: agentPlace({ sessionId, agentId }) }),
      onOpenInReview: (fix) =>
        void openReview({ sessionId, destination: { kind: 'notes', threadIds: [fix.threadId] } }),
    };
    const threadIdOf = new Map(fixes.map((fix) => [fix.note.id, fix.threadId] as const));
    return {
      threads: fixes.map((fix) => threadOf({ fix, handlers })),
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
    navigate,
    showDiffNoteLaunch,
    reopenDiffComment,
    sessionId,
  ]);

  return { comments, fixes };
};
