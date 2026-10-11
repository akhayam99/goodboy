import { useEffect, useMemo, useState } from 'react';
import { Wrench } from 'lucide-react';
import { Button, DrawerFrame, ScrollFade, SectionHeader, SegmentedTabs } from '@goodboy/ui';
import type { OpenQuestion, ResolveAttempt, SessionId } from '@goodboy/types';
import { AgentChain } from '../../../../shared/components/AgentChain';
import { useAppStore } from '../../../../store';
import { openQuestionOfThread } from '../../../../store/slices/resolve/threadQuestions';
import { commentOutcomeOf, type CommentOutcome } from '../../commentOutcome';
import { outcomeSummaryLine } from '../../commentOutcomeCopy';
import { useDraftRouting } from '../ReviewFlow/useDraftRouting';
import { useReviewEntries } from '../ReviewFlow/useReviewEntries';
import { groupConversationsByFile } from '../../groupConversationsByFile';
import { COMMENT_FILTERS, filteredEntries, isNoteEntry, type CommentFilter } from './commentFilter';
import { FIX_COMMENTS_LABEL, FILTER_LABEL } from './fixCommentsCopy';
import { BatchActions, type BatchReply } from './BatchActions';
import { CommentOutcomeRow } from './CommentOutcomeRow';
import { FixCommentRow } from './FixCommentRow';
import { FixCommentsLaunchRow } from './FixCommentsLaunchRow';
import { ModelChipPicker } from './ModelChipPicker';
import { useFixChain } from './useFixChain';
import { useFixLaunch } from './useFixLaunch';

type Props = {
  readonly sessionId: SessionId;
  readonly focusThreadId: string | null;
  readonly threadIds: ReadonlyArray<string> | null;
  readonly onClose: () => void;
};

const NO_QUESTIONS: ReadonlyArray<OpenQuestion> = [];
const NO_ATTEMPTS: ReadonlyArray<ResolveAttempt> = [];

const FILTER_OPTIONS = COMMENT_FILTERS.map((value) => ({ value, label: FILTER_LABEL[value] }));

export const FixCommentsDrawer = ({ sessionId, focusThreadId, threadIds, onClose }: Props) => {
  const { all } = useReviewEntries({ sessionId, scope: 'all' });
  const draft = useDraftRouting({ sessionId });
  const steps = useFixChain({ sessionId });
  const [filter, setFilter] = useState<CommentFilter>('all');
  const questions = useAppStore((s) => s.sessionOpenQuestions[sessionId] ?? NO_QUESTIONS);
  const attempts = useAppStore((s) => s.sessionResolveAttempts[sessionId] ?? NO_ATTEMPTS);
  const loadSessionOpenQuestions = useAppStore((s) => s.loadSessionOpenQuestions);
  useEffect(() => {
    void loadSessionOpenQuestions(sessionId);
  }, [loadSessionOpenQuestions, sessionId]);
  const open = useMemo(() => all.filter((entry) => entry.isFixable), [all]);
  const outcomes = useMemo(
    () =>
      new Map<string, CommentOutcome | null>(
        all.map((entry) => [
          entry.threadId,
          commentOutcomeOf({
            thread: entry.row.thread,
            item: entry.row.item,
            question:
              openQuestionOfThread({
                questions,
                attempts,
                threadId: entry.threadId,
                question: entry.row.thread.question,
              }) ?? null,
            verdict: entry.facts?.verdict ?? null,
            failure: entry.row.rowState.sentence,
          }),
        ]),
      ),
    [all, attempts, questions],
  );
  const listed = useMemo(
    () =>
      all.filter((entry) => {
        const kind = outcomes.get(entry.threadId)?.kind ?? null;
        return entry.isFixable || (kind !== null && kind !== 'waiting');
      }),
    [all, outcomes],
  );
  const [explicit, setExplicit] = useState<ReadonlySet<string> | null>(() => {
    if (threadIds !== null) {
      return new Set(threadIds);
    }
    return focusThreadId === null ? null : new Set([focusThreadId]);
  });
  const picked = useMemo(
    () => explicit ?? new Set(open.map((entry) => entry.threadId)),
    [explicit, open],
  );
  const shown = useMemo(() => filteredEntries({ entries: listed, filter }), [filter, listed]);
  const shownFixable = useMemo(() => shown.filter((entry) => entry.isFixable), [shown]);
  const entryById = useMemo(
    () => new Map(listed.map((entry) => [entry.threadId, entry] as const)),
    [listed],
  );
  const groups = useMemo(
    () => groupConversationsByFile({ rows: shown.map((entry) => entry.row) }),
    [shown],
  );
  const selectedIds = open.filter((entry) => picked.has(entry.threadId)).map((e) => e.threadId);
  const isAllShown =
    shownFixable.length > 0 && shownFixable.every((entry) => picked.has(entry.threadId));
  const batchFixes = useMemo(
    () => listed.filter((entry) => outcomes.get(entry.threadId)?.kind === 'fix-proposed'),
    [listed, outcomes],
  );
  const batchReplies = useMemo(
    () =>
      listed.flatMap((entry): ReadonlyArray<BatchReply> => {
        const outcome = outcomes.get(entry.threadId);
        const reply = outcome?.kind === 'no-change' ? outcome.reply : '';
        return reply.trim() === '' || isNoteEntry({ entry }) ? [] : [{ entry, reply }];
      }),
    [listed, outcomes],
  );
  const summary = outcomeSummaryLine({
    fixes: batchFixes.length,
    questions: listed.filter((entry) => outcomes.get(entry.threadId)?.kind === 'question').length,
    replies: listed.filter((entry) => outcomes.get(entry.threadId)?.kind === 'no-change').length,
  });
  const launch = useFixLaunch({
    sessionId,
    routing: draft.routing,
    threadIds: selectedIds,
    hint: '',
    onStarted: onClose,
  });

  const toggle = (threadId: string): void => {
    const next = new Set(picked);
    if (!next.delete(threadId)) {
      next.add(threadId);
    }
    setExplicit(next);
  };

  const toggleAll = (): void => {
    const next = new Set(picked);
    for (const entry of shownFixable) {
      if (isAllShown) {
        next.delete(entry.threadId);
        continue;
      }
      next.add(entry.threadId);
    }
    setExplicit(next);
  };

  return (
    <DrawerFrame
      title={FIX_COMMENTS_LABEL.title}
      icon={Wrench}
      count={
        <ModelChipPicker
          suggested={draft.suggested}
          routing={draft.routing}
          isOverridden={draft.isOverridden}
          connectedProviders={draft.connectedProviders}
          isDisabled={launch.isStarting}
          onChange={draft.save}
        />
      }
      onClose={onClose}
    >
      <div className="flex min-w-0 flex-col gap-4">
        {steps.length > 0 && (
          <section className="flex flex-col gap-2">
            <SectionHeader headingLevel={3} label={FIX_COMMENTS_LABEL.activity} />
            <AgentChain sessionId={sessionId} steps={steps} />
            {summary !== '' && <p className="text-meta text-muted-foreground">{summary}</p>}
          </section>
        )}
        <section className="flex min-w-0 flex-col gap-2">
          <SectionHeader
            headingLevel={3}
            label={FIX_COMMENTS_LABEL.comments}
            action={
              shownFixable.length > 0 ? (
                <Button size="sm" variant="ghost" onClick={toggleAll}>
                  {isAllShown ? 'Clear' : FIX_COMMENTS_LABEL.selectAll}
                </Button>
              ) : undefined
            }
          />
          <SegmentedTabs
            ariaLabel={FIX_COMMENTS_LABEL.filters}
            size="xs"
            options={FILTER_OPTIONS}
            value={filter}
            onChange={setFilter}
          />
          {groups.length === 0 ? (
            <p className="text-body text-muted-foreground">{FIX_COMMENTS_LABEL.empty}</p>
          ) : (
            <ScrollFade className="max-h-[60vh]">
              <ul aria-label={FIX_COMMENTS_LABEL.list} className="flex flex-col gap-3">
                {groups.map((group) => (
                  <li key={group.key} className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate px-2 text-meta text-faint-foreground">
                      {group.path ?? 'General'}
                    </span>
                    <ul className="flex flex-col gap-0.5">
                      {group.rows.map((row) => {
                        const entry = entryById.get(row.thread.threadId);
                        if (entry === undefined) {
                          return null;
                        }
                        const outcome = outcomes.get(entry.threadId) ?? null;
                        const isOutcomeShown = outcome !== null && outcome.kind !== 'waiting';
                        return (
                          <li
                            key={row.thread.threadId}
                            className="flex min-w-0 list-none flex-col gap-0.5"
                          >
                            {entry.isFixable && (
                              <FixCommentRow
                                entry={entry}
                                isIncluded={picked.has(entry.threadId)}
                                onToggle={() => toggle(entry.threadId)}
                              />
                            )}
                            {isOutcomeShown && (
                              <CommentOutcomeRow
                                sessionId={sessionId}
                                entry={entry}
                                outcome={outcome}
                                routing={draft.routing}
                                isHeaderShown={!entry.isFixable}
                                onStarted={onClose}
                              />
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ul>
            </ScrollFade>
          )}
          <BatchActions sessionId={sessionId} fixes={batchFixes} replies={batchReplies} />
          <FixCommentsLaunchRow
            count={selectedIds.length}
            startedMode={launch.startedMode}
            error={launch.error}
            onStart={(mode) => void launch.start(mode)}
          />
        </section>
      </div>
    </DrawerFrame>
  );
};
