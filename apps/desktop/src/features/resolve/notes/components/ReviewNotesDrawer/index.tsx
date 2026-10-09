import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, DrawerFrame, formatError } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { branchPlace } from '../../../../../store/slices/navigation/place';
import { isReportedError } from '../../../../../store/slices/notifications/reportedError';
import { resolveReviewTarget } from '../../../../../store/slices/review-drafts/resolveReviewTarget';
import { isFileLevelDraft } from '../../../../../store/slices/review-drafts/fileLevel';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';
import { useActionEnv } from '../../../../actions/useActionEnv';
import { useObjectActions } from '../../../../actions/useObjectActions';
import { ResolveRunStatus } from '../../../components/ReviewFlow/ResolveRunStatus';
import { FIX_RUN_CHIPS, FIX_RUN_CHIP_WORDS, type FixRunChipKey } from '../../../fixRun';
import { useReviewCommentController } from '../../../hooks/useReviewCommentController';
import { noteIdOfThread } from '../../noteThread';
import { reviewNotesDrawer } from '../../notesDrawer';
import {
  REVIEW_NOTES_COPY,
  fixNotesLabel,
  notesOpenCount,
  olderDraftsLine,
} from '../../reviewNotesCopy';
import { useFixStartedToast } from '../../../hooks/useFixStartedToast';
import { startNoteFix } from '../../startNoteFix';
import { useReviewNotes } from '../../useReviewNotes';
import { ClosedNote } from './ClosedNote';
import { NoteFileGroup } from './NoteFileGroup';
import { NoteItem } from './NoteItem';
import { ReviewNotesMenu } from './ReviewNotesMenu';

type Props = {
  readonly sessionId: SessionId;
  readonly mountPath: string | null;
  readonly focusPath: string | null;
  readonly focusThreadId: string | null;
  readonly onClose: () => void;
};

const POST_NOTES_ACTION = 'review.postNotes';

const NONE_EXCLUDED: ReadonlySet<string> = new Set();

export const ReviewNotesDrawer = ({
  sessionId,
  mountPath,
  focusPath,
  focusThreadId,
  onClose,
}: Props) => {
  const notes = useReviewNotes({ sessionId });
  const announceStart = useFixStartedToast();
  const env = useActionEnv({ origin: 'button' });
  const reviewTarget = useMemo(() => ({ kind: 'review' as const, sessionId }), [sessionId]);
  const { actions, run } = useObjectActions({ target: reviewTarget, env });
  const navigate = useAppStore((s) => s.navigate);
  const openDrawer = useAppStore((s) => s.openDrawer);
  const closeDrawer = useAppStore((s) => s.closeDrawer);
  const loadResolveSession = useAppStore((s) => s.loadResolveSession);
  const forceCloseResolver = useAppStore((s) => s.forceCloseResolver);
  const stopResolveLane = useAppStore((s) => s.stopResolveLane);
  const reopenDiffComment = useAppStore((s) => s.reopenDiffComment);
  const setPullRequestMode = useAppStore((s) => s.setPullRequestMode);
  const consumeReviewLaunch = useAppStore((s) => s.consumeReviewLaunch);
  const launchRequest = useAppStore((s) => s.reviewLaunchRequests[sessionId] ?? null);
  const hasPullRequest = useAppStore((s) => resolveReviewTarget({ state: s, sessionId }) !== null);
  const olderDrafts = useAppStore(
    (s) =>
      (s.reviewDrafts[sessionId] ?? []).filter(
        (draft) => draft.status === 'draft' && isFileLevelDraft({ draft }),
      ).length,
  );
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(NONE_EXCLUDED);
  const [filter, setFilter] = useState<FixRunChipKey | null>(null);
  const [isClosedShown, setIsClosedShown] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const { run: fixRun } = notes;
  const noteThreadIds = useMemo(
    () =>
      notes.entries
        .map((entry) => entry.threadId)
        .filter((threadId) => noteIdOfThread({ threadId }) !== null),
    [notes.entries],
  );
  const controller = useReviewCommentController({
    sessionId,
    entries: notes.entries,
    threadIds: noteThreadIds,
  });

  useEffect(() => {
    void loadResolveSession({ sessionId });
  }, [loadResolveSession, sessionId]);

  const selectedIds = useMemo(
    () => notes.fixableIds.filter((threadId) => !excluded.has(threadId)),
    [excluded, notes.fixableIds],
  );

  const startFix = useCallback(
    async (threadIds: ReadonlyArray<string>): Promise<void> => {
      if (isStarting || threadIds.length === 0) {
        return;
      }
      setIsStarting(true);
      setStartError(null);
      try {
        const started = await startNoteFix({
          getState: useAppStore.getState,
          sessionId,
          threadIds,
        });
        announceStart({ sessionId, started, count: threadIds.length, noun: 'note' });
        setExcluded(NONE_EXCLUDED);
      } catch (caught) {
        if (!isReportedError(caught)) {
          setStartError(formatError(caught));
        }
      } finally {
        setIsStarting(false);
      }
    },
    [announceStart, isStarting, sessionId],
  );

  useEffect(() => {
    if (launchRequest === null || launchRequest.threadIds.length === 0) {
      return;
    }
    const ids = launchRequest.threadIds;
    if (!ids.every((threadId) => noteIdOfThread({ threadId }) !== null)) {
      return;
    }
    const fixable = new Set(notes.fixableIds);
    if (!ids.some((threadId) => fixable.has(threadId))) {
      return;
    }
    consumeReviewLaunch({ sessionId, requestId: launchRequest.requestId });
    void startFix(ids.filter((threadId) => fixable.has(threadId)));
  }, [consumeReviewLaunch, launchRequest, notes.fixableIds, sessionId, startFix]);

  useEffect(() => {
    const root = bodyRef.current;
    if (root === null) {
      return;
    }
    const target =
      focusThreadId !== null
        ? root.querySelector<HTMLElement>(`[data-note-thread="${CSS.escape(focusThreadId)}"]`)
        : focusPath === null
          ? null
          : (Array.from(root.querySelectorAll<HTMLElement>('[data-note-file]')).find(
              (element) => element.dataset.noteFile === focusPath,
            ) ?? null);
    target?.scrollIntoView?.({ block: 'start' });
  }, [focusPath, focusThreadId, notes.groups.length]);

  const jump = useCallback(
    (path: string | null) => {
      if (path === null) {
        return;
      }
      navigate({
        to: branchPlace({
          sessionId,
          mountPath,
          tab: 'files',
          focus: { kind: 'branch', path },
        }),
        drawer: reviewNotesDrawer({ sessionId, mountPath }),
        mode: 'replace',
      });
    },
    [mountPath, navigate, sessionId],
  );

  const focusThread = useCallback((threadId: string) => {
    bodyRef.current
      ?.querySelector<HTMLElement>(`[data-note-thread="${CSS.escape(threadId)}"]`)
      ?.scrollIntoView?.({ block: 'nearest' });
  }, []);

  const toggleIncluded = useCallback((threadId: string) => {
    setExcluded((current) => {
      const next = new Set(current);
      if (!next.delete(threadId)) {
        next.add(threadId);
      }
      return next;
    });
  }, []);

  const postNotes = actions.find((action) => action.id === POST_NOTES_ACTION) ?? null;
  const activeFilterCount =
    fixRun === null || filter === null
      ? 0
      : (FIX_RUN_CHIPS.find((chip) => chip.key === filter)?.countOf(fixRun.tally) ?? 0);
  const activeFilter = activeFilterCount > 0 ? filter : null;
  const groups = useMemo(
    () =>
      activeFilter === null
        ? notes.groups
        : notes.groups
            .map((group) => ({
              ...group,
              entries: group.entries.filter((entry) =>
                FIX_RUN_CHIP_WORDS[activeFilter].includes(entry.resolveWord),
              ),
            }))
            .filter((group) => group.entries.length > 0),
    [activeFilter, notes.groups],
  );
  const isSelecting = notes.fixableIds.length > 1;

  const dock =
    hasPullRequest && olderDrafts > 0 ? (
      <p className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-meta text-muted-foreground">
        <span>{olderDraftsLine({ count: olderDrafts })}</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            closeDrawer();
            setPullRequestMode({ sessionId, mode: 'write_review' });
          }}
        >
          {REVIEW_NOTES_COPY.openReviewDraft}
        </Button>
      </p>
    ) : undefined;

  return (
    <DrawerFrame
      title={REVIEW_NOTES_COPY.title}
      icon={CONCEPT_ICONS.comments}
      iconClassName="text-muted-foreground"
      count={notesOpenCount({ count: notes.open.length })}
      closeLabel={REVIEW_NOTES_COPY.close}
      onClose={onClose}
      action={
        <>
          {selectedIds.length === 0 ? null : (
            <Button
              size="sm"
              variant="primary"
              isBusy={isStarting}
              onClick={() => void startFix(selectedIds)}
            >
              {fixNotesLabel({ count: selectedIds.length })}
            </Button>
          )}
          <ReviewNotesMenu
            moveLabel={postNotes === null ? null : postNotes.label}
            isClosedShown={isClosedShown}
            onMove={() => {
              if (postNotes !== null) {
                void run({ actionId: postNotes.id });
              }
            }}
            onToggleClosed={() => setIsClosedShown((current) => !current)}
          />
        </>
      }
    >
      <div ref={bodyRef} className="flex min-w-0 flex-col gap-6">
        {fixRun === null ? null : (
          <ResolveRunStatus
            run={fixRun}
            noun="note"
            filter={activeFilter}
            onFilter={setFilter}
            lane={notes.lane}
            onOpenTranscript={() =>
              openDrawer({
                kind: 'transcript',
                sessionId,
                payload: { agentId: fixRun.agentId },
              })
            }
            onStop={() =>
              void (notes.lane === null
                ? forceCloseResolver(sessionId, fixRun.agentId)
                : stopResolveLane({ sessionId, worktreePath: notes.lane.worktreePath }))
            }
          />
        )}
        {startError === null ? null : (
          <p role="alert" className="text-meta text-danger">
            {startError}
          </p>
        )}
        {groups.length === 0 && !isClosedShown ? (
          <p className="text-meta text-muted-foreground">{REVIEW_NOTES_COPY.empty}</p>
        ) : null}
        {groups.map((group) => (
          <NoteFileGroup key={group.key} path={group.path}>
            {group.entries.map((entry) => (
              <NoteItem
                key={entry.threadId}
                sessionId={sessionId}
                entry={entry}
                entries={notes.entries}
                controller={controller}
                inclusion={
                  isSelecting && entry.isFixable
                    ? {
                        isIncluded: !excluded.has(entry.threadId),
                        onToggle: () => toggleIncluded(entry.threadId),
                      }
                    : null
                }
                onJump={() => jump(group.path)}
                onSelect={focusThread}
              />
            ))}
          </NoteFileGroup>
        ))}
        {dock}
        {isClosedShown && notes.closed.length > 0 ? (
          <section aria-label={REVIEW_NOTES_COPY.closedHeading} className="flex flex-col gap-3">
            <h3 className="text-label text-muted-foreground">{REVIEW_NOTES_COPY.closedHeading}</h3>
            <ul className="flex min-w-0 flex-col gap-3">
              {notes.closed.map((note) => (
                <ClosedNote
                  key={note.id}
                  note={note}
                  onReopen={() => void reopenDiffComment(sessionId, note.id)}
                />
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </DrawerFrame>
  );
};
