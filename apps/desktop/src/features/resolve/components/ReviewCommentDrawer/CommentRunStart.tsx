import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Button } from '@goodboy/ui';
import type { MountId, SessionId, WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { PromptField } from '../../../../shared/components/PromptField';
import { useAutoTreeLimit } from '../../../auto/useAutoTreeLimit';
import { RunsStartForm } from '../../../session/components/StartForm/RunsStartForm';
import { RunModelChip } from '../../../session/components/StartRun/RunModelChip';
import {
  useStartRun,
  type StartRunSources,
} from '../../../session/components/StartRun/useStartRun';
import { COMMENT_RUN_COPY } from '../../commentRunCopy';
import { commentRunQuoteOf } from '../../commentRunQuoteOf';
import { commentRunSourceLabelOf } from '../../commentRunSourceLabelOf';
import { commentRunSourcesOf } from '../../commentRunSourcesOf';
import { runGoalOf } from '../../runGoalOf';
import type { ReviewEntry } from '../ReviewFlow/useReviewEntries';
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

type ExtrasParams = {
  readonly extraThreadIds: ReadonlyArray<string>;
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
  const limit = useAutoTreeLimit({ workspaceId, sessionId });
  const onLaunched = useCallback(
    () => finishStart({ sessionId, threadId }),
    [finishStart, sessionId, threadId],
  );
  const run = useStartRun({
    workspaceId,
    sessionId,
    prepare: limit.start,
    settleLimit: limit.settle,
    seedText,
    seedBranch: mountBranch,
    sources: runSources,
    onLaunched,
  });
  const textRef = useRef(run.text);
  textRef.current = run.text;

  useEffect(
    () => () => keepGoal({ sessionId, threadId, goal: textRef.current }),
    [keepGoal, sessionId, threadId],
  );

  const pickExtras = ({ extraThreadIds: next }: ExtrasParams): void => {
    const nextSources = commentRunSourcesOf({ entries, agents, threadId, extraThreadIds: next });
    if (run.text.trim() === goalOf({ picked: sources.picked }).trim()) {
      run.setText(goalOf({ picked: nextSources.picked }));
    }
    setExtras({ sessionId, threadId, extraThreadIds: next });
  };

  const hasHost = sources.picked.some((picked) => !isNoteEntry({ entry: picked }));
  const pickedCount = sources.picked.length;

  return (
    <section
      aria-label={COMMENT_RUN_COPY.label}
      data-comment-run-start={threadId}
      className="flex min-w-0 flex-col gap-4"
    >
      <PromptField
        kind="message"
        label={COMMENT_RUN_COPY.goal}
        value={run.text}
        onChange={run.setText}
        onSubmit={() => void run.start()}
        isSubmitBlocked={run.text.trim() === '' || run.isStarting || sources.blocked !== null}
        disabled={run.isStarting}
        minRows={3}
        maxRows={10}
        keyLabels={{ send: 'start' }}
        header={
          <p className="px-3 pt-2 text-meta text-faint-foreground">
            {pickedCount > 1
              ? COMMENT_RUN_COPY.goalHintMany({ count: pickedCount })
              : COMMENT_RUN_COPY.goalHint}
          </p>
        }
        model={<RunModelChip model={run.model} isDisabled={run.isStarting} variant="pill" />}
      />
      <CommentRunSourceChips
        picked={sources.picked}
        candidates={sources.candidates}
        primaryThreadId={threadId}
        isDisabled={run.isStarting}
        onAdd={(id) => pickExtras({ extraThreadIds: [...extraThreadIds, id] })}
        onRemove={(id) =>
          pickExtras({ extraThreadIds: extraThreadIds.filter((extra) => extra !== id) })
        }
      />
      <RunsStartForm
        workspaceId={workspaceId}
        sessionId={sessionId}
        role={null}
        run={run}
        limit={limit}
        hint={null}
        note={hasHost ? COMMENT_RUN_COPY.hostNote : COMMENT_RUN_COPY.localNote}
        blockedReason={sources.blocked}
        canDiscard={false}
        isBranchLocked
        actions={
          <Button
            variant="ghost"
            size="sm"
            disabled={run.isStarting}
            onClick={() => closeStart({ sessionId, threadId, goal: run.text })}
          >
            {COMMENT_RUN_COPY.cancel}
          </Button>
        }
      />
    </section>
  );
};
