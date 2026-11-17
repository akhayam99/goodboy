import { useCallback, useMemo, useRef } from 'react';
import type { MountId, SessionId, WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { StartRunFromSources } from '../../../../session/startRun/StartRunFromSources';
import type { StartRunSources } from '../../../../session/startRun/startRunSources';
import { COMMENT_RUN_COPY } from '../../../commentRunCopy';
import { commentRunQuoteOf } from '../../../commentRunQuoteOf';
import { commentRunSourceLabelOf } from '../../../commentRunSourceLabelOf';
import { commentRunSourcesOf } from '../../../commentRunSourcesOf';
import { runGoalOf } from '../../../runGoalOf';
import type { ReviewEntry } from '../../ReviewFlow/useReviewEntries';
import { CommentRunSourceChips } from './CommentRunSourceChips';

type Props = {
  readonly sessionId: SessionId;
  readonly workspaceId: WorkspaceId;
  readonly mountId: MountId | null;
  readonly entry: ReviewEntry;
  readonly entries: ReadonlyArray<ReviewEntry>;
};

type PickedParams = {
  readonly picked: ReadonlyArray<ReviewEntry>;
};

type EntryParams = {
  readonly entry: ReviewEntry;
};

type PickParams = {
  readonly extraThreadIds: ReadonlyArray<string>;
  readonly text: string;
  readonly setText: (text: string) => void;
};

const NO_EXTRAS: ReadonlyArray<string> = [];

const isNoteEntry = ({ entry }: EntryParams): boolean =>
  entry.row.thread.originKind === 'diff_comment';

const goalOf = ({ picked }: PickedParams): string =>
  runGoalOf({
    comments: picked.flatMap(({ row }) =>
      row.reviewerNote === null
        ? []
        : [
            {
              body: row.reviewerNote.body,
              path: row.reviewerNote.path,
              line: row.reviewerNote.line,
            },
          ],
    ),
  });

const quoteOf = ({ picked }: PickedParams): string =>
  commentRunQuoteOf({
    comments: picked.flatMap((entry) => {
      const note = entry.row.reviewerNote;
      if (note === null) {
        return [];
      }
      const label = commentRunSourceLabelOf({ thread: entry.row.thread });
      return [
        {
          source: isNoteEntry({ entry }) ? 'A local note' : `A ${label} comment`,
          author: note.author,
          body: note.body,
          path: note.path,
          line: note.line,
        },
      ];
    }),
  });

export const CommentRunStart = ({ sessionId, workspaceId, mountId, entry, entries }: Props) => {
  const threadId = entry.threadId;
  const draft = useAppStore((state) => state.commentRunStarts[sessionId]?.drafts[threadId] ?? null);
  const agents = useAppStore((state) => state.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const mountBranch = useAppStore((state) => {
    const attached = (state.sessionMounts[sessionId] ?? EMPTY_ARRAY).filter(
      (mount) => mount.isAttached,
    );
    const mount =
      mountId === null
        ? attached.length === 1
          ? attached[0]
          : undefined
        : attached.find((candidate) => candidate.id === mountId);
    return mount?.branch ?? null;
  });
  const closeStart = useAppStore((state) => state.closeCommentRunStart);
  const keepGoal = useAppStore((state) => state.keepCommentRunGoal);
  const setExtras = useAppStore((state) => state.setCommentRunExtras);
  const finishStart = useAppStore((state) => state.finishCommentRunStart);
  const extraThreadIds = draft?.extraThreadIds ?? NO_EXTRAS;
  const sources = useMemo(
    () => commentRunSourcesOf({ entries, agents, threadId, extraThreadIds }),
    [agents, entries, extraThreadIds, threadId],
  );
  const runSources = useMemo(
    (): StartRunSources => ({
      threadIds: sources.picked.map((picked) => picked.threadId),
      mountId,
      quote: quoteOf({ picked: sources.picked }),
    }),
    [mountId, sources.picked],
  );
  const seedText = useRef(draft?.goal ?? goalOf({ picked: sources.picked })).current;
  const seedBranch = useRef(mountBranch).current;
  const onLaunched = useCallback(
    () => finishStart({ sessionId, threadId }),
    [finishStart, sessionId, threadId],
  );

  const pickExtras = ({ extraThreadIds: next, text, setText }: PickParams): void => {
    const nextSources = commentRunSourcesOf({ entries, agents, threadId, extraThreadIds: next });
    if (text.trim() === goalOf({ picked: sources.picked }).trim()) {
      setText(goalOf({ picked: nextSources.picked }));
    }
    setExtras({ sessionId, threadId, extraThreadIds: next });
  };

  const hasHost = sources.picked.some((picked) => !isNoteEntry({ entry: picked }));
  const pickedCount = sources.picked.length;

  return (
    <StartRunFromSources
      workspaceId={workspaceId}
      sessionId={sessionId}
      label={COMMENT_RUN_COPY.label}
      fieldLabel={COMMENT_RUN_COPY.goal}
      seedText={seedText}
      seedBranch={seedBranch}
      sources={runSources}
      header={
        <p className="px-3 pt-2 text-meta text-faint-foreground">
          {pickedCount > 1
            ? COMMENT_RUN_COPY.goalHintMany({ count: pickedCount })
            : COMMENT_RUN_COPY.goalHint}
        </p>
      }
      note={hasHost ? COMMENT_RUN_COPY.hostNote : COMMENT_RUN_COPY.localNote}
      blockedReason={sources.blocked}
      cancelLabel={COMMENT_RUN_COPY.cancel}
      between={({ isStarting, text, setText }) => (
        <CommentRunSourceChips
          picked={sources.picked}
          candidates={sources.candidates}
          primaryThreadId={threadId}
          isDisabled={isStarting}
          onAdd={(id) => pickExtras({ extraThreadIds: [...extraThreadIds, id], text, setText })}
          onRemove={(id) =>
            pickExtras({
              extraThreadIds: extraThreadIds.filter((extra) => extra !== id),
              text,
              setText,
            })
          }
        />
      )}
      onCancel={({ text }) => closeStart({ sessionId, threadId, goal: text })}
      onLeave={({ text }) => keepGoal({ sessionId, threadId, goal: text })}
      onLaunched={onLaunched}
    />
  );
};
