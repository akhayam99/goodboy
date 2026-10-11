import { useMemo, useState } from 'react';
import { Wrench } from 'lucide-react';
import { Button, DrawerFrame, ScrollFade, SectionHeader, SegmentedTabs } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { requestHostOf } from '../../../../store/slices/review-source/requestHostOf';
import { AgentChain } from '../../../../shared/components/AgentChain';
import { useDraftRouting } from '../ReviewFlow/useDraftRouting';
import { useReviewEntries } from '../ReviewFlow/useReviewEntries';
import { groupConversationsByFile } from '../../groupConversationsByFile';
import { COMMENT_FILTERS, filteredEntries, type CommentFilter } from './commentFilter';
import { FIX_COMMENTS_LABEL, filterLabelOf } from './fixCommentsCopy';
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

export const FixCommentsDrawer = ({ sessionId, focusThreadId, threadIds, onClose }: Props) => {
  const { all } = useReviewEntries({ sessionId, scope: 'all' });
  const draft = useDraftRouting({ sessionId });
  const steps = useFixChain({ sessionId });
  const [filter, setFilter] = useState<CommentFilter>('all');
  const host = useAppStore((state) => requestHostOf({ state, sessionId }));
  const filterOptions = useMemo(
    () => COMMENT_FILTERS.map((value) => ({ value, label: filterLabelOf({ host })[value] })),
    [host],
  );
  const open = useMemo(() => all.filter((entry) => entry.isFixable), [all]);
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
  const shown = useMemo(() => filteredEntries({ entries: open, filter }), [filter, open]);
  const entryById = useMemo(
    () => new Map(open.map((entry) => [entry.threadId, entry] as const)),
    [open],
  );
  const groups = useMemo(
    () => groupConversationsByFile({ rows: shown.map((entry) => entry.row) }),
    [shown],
  );
  const selectedIds = open.filter((entry) => picked.has(entry.threadId)).map((e) => e.threadId);
  const isAllShown = shown.length > 0 && shown.every((entry) => picked.has(entry.threadId));
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
    for (const entry of shown) {
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
          </section>
        )}
        <section className="flex min-w-0 flex-col gap-2">
          <SectionHeader
            headingLevel={3}
            label={FIX_COMMENTS_LABEL.comments}
            action={
              shown.length > 0 ? (
                <Button size="sm" variant="ghost" onClick={toggleAll}>
                  {isAllShown ? 'Clear' : FIX_COMMENTS_LABEL.selectAll}
                </Button>
              ) : undefined
            }
          />
          <SegmentedTabs
            ariaLabel={FIX_COMMENTS_LABEL.filters}
            size="xs"
            options={filterOptions}
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
                        return entry === undefined ? null : (
                          <li key={row.thread.threadId} className="min-w-0 list-none">
                            <FixCommentRow
                              entry={entry}
                              isIncluded={picked.has(entry.threadId)}
                              onToggle={() => toggle(entry.threadId)}
                            />
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ul>
            </ScrollFade>
          )}
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
