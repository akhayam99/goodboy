import { useEffect, useMemo, useState } from 'react';
import {
  cn,
  DiffLayoutToggle,
  formatError,
  HeaderBand,
  ResizeHandle,
  ScrollFade,
  Skeleton,
} from '@goodboy/ui';
import type { PrReviewDraft, Session, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import type { PublishPrReviewVerdict } from '../../../../store/slices/review-drafts/types';
import { useToast } from '../../../../app/components/Toast';
import { classifyAgent } from '../../../session/agent-kind';
import { RefreshIconButton } from '@goodboy/ui';
import { StudioDetailLayout } from '../../../../shared/components/StudioDetail';
import { LensEmptyState } from '@goodboy/ui';
import { ErrorStrip } from '@goodboy/ui';
import { DraftsPanel } from './DraftsPanel';
import { PublishBar } from './PublishBar';
import { ReviewFileDiff, type ReviewLineTarget } from './ReviewFileDiff';
import { useReviewDiff } from './useReviewDiff';
import { useColumnWidth } from '../../../../shared/hooks/useColumnWidth';
import { useDiffLayoutMode } from '../../../../shared/hooks/useDiffLayoutMode';
import { STORAGE_KEYS } from '../../../../shared/lib/storage-keys';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { PANE_RHYTHM } from '@goodboy/ui';

type Props = {
  readonly session: Session;
};

export const ReviewBoardPane = ({ session }: Props) => {
  const sessionId = session.id as SessionId;
  const [listWidth, setListWidth] = useColumnWidth(STORAGE_KEYS.reviewBoardListWidth, 320);
  const drafts = useAppStore(
    (s) => s.reviewDrafts[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<PrReviewDraft>),
  );
  const loadReviewDrafts = useAppStore((s) => s.loadReviewDrafts);
  const addReviewDraft = useAppStore((s) => s.addReviewDraft);
  const updateReviewDraft = useAppStore((s) => s.updateReviewDraft);
  const discardReviewDraft = useAppStore((s) => s.discardReviewDraft);
  const publishPrReview = useAppStore((s) => s.publishPrReview);
  const setAgentDraft = useAppStore((s) => s.setAgentDraft);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const phaseRuns = useAppStore((s) => s.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const { files, loading, error, target, refresh } = useReviewDiff({ session });
  const [layoutMode, setLayoutMode] = useDiffLayoutMode();
  const { showToast } = useToast();
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    void loadReviewDrafts(sessionId);
  }, [loadReviewDrafts, sessionId]);

  const openDrafts = useMemo(() => drafts.filter((draft) => draft.status === 'draft'), [drafts]);
  const draftsByPath = useMemo(() => {
    const byPath = new Map<string, PrReviewDraft[]>();
    for (const draft of openDrafts) {
      const list = byPath.get(draft.path);
      if (list != null) {
        list.push(draft);
        continue;
      }
      byPath.set(draft.path, [draft]);
    }
    return byPath;
  }, [openDrafts]);

  const addDraftFromLine = async (lineTarget: ReviewLineTarget, body: string) => {
    try {
      await addReviewDraft({
        sessionId,
        path: lineTarget.path,
        line: lineTarget.line,
        side: lineTarget.side,
        body,
      });
    } catch (err) {
      showToast('error', formatError(err));
    }
  };

  const askAgent = (lineTarget: ReviewLineTarget) => {
    const reviewer =
      phaseRuns.find((agent) => classifyAgent(agent, null) === 'pr-reviewer') ?? phaseRuns[0];
    if (reviewer == null) {
      showToast('error', 'No agent in this session to ask.');
      return;
    }
    const prompt = `About \`${lineTarget.path}:${lineTarget.line}\`:\n> ${lineTarget.text}\n`;
    const existing = useAppStore.getState().agentDraft[reviewer.id] ?? '';
    setAgentDraft(reviewer.id, existing === '' ? prompt : `${existing}\n${prompt}`);
    void selectAgent(sessionId, reviewer.id);
  };

  const publish = async (opts: { verdict: PublishPrReviewVerdict; body: string }) => {
    if (publishing) {
      return;
    }
    setPublishing(true);
    try {
      const result = await publishPrReview(sessionId, opts);
      const staleNote = result.stale.length > 0 ? `, ${result.stale.length} stale skipped` : '';
      const mismatchedNote =
        result.mismatched.length > 0
          ? `, ${result.mismatched.length} left for a different pull request`
          : '';
      if (result.failed.length > 0) {
        showToast(
          'error',
          `${result.failed.length} comments failed to publish${staleNote}${mismatchedNote}`,
        );
      } else {
        const publishedNote =
          result.published > 0
            ? `${result.published} ${result.published === 1 ? 'comment' : 'comments'} published`
            : 'summary posted';
        showToast('success', `Review published: ${publishedNote}${staleNote}${mismatchedNote}`);
      }
      await loadReviewDrafts(sessionId);
      refresh();
    } catch (err) {
      showToast('error', formatError(err));
    } finally {
      setPublishing(false);
    }
  };

  const header = (
    <HeaderBand
      title="Review board"
      meta={
        <>
          {target != null ? (
            <span className="min-w-0 truncate font-mono text-2xs text-muted-foreground">
              {`${target.repo} ${target.provider === 'gitlab' ? '!' : '#'}${target.prNumber}`}
            </span>
          ) : null}
          <span className="text-2xs tabular-nums text-muted-foreground/60">
            {loading ? '' : `${files.length} files`}
          </span>
        </>
      }
      actions={
        <>
          <DiffLayoutToggle mode={layoutMode} onChange={setLayoutMode} />
          <RefreshIconButton
            label="Refresh diff"
            isLoading={loading}
            onClick={refresh}
            iconSize={12}
            className="size-6 border-transparent p-0"
          />
        </>
      }
    />
  );

  return (
    <StudioDetailLayout
      header={header}
      fit="bleed"
      dock={
        <PublishBar
          provider={target?.provider ?? 'github'}
          draftCount={openDrafts.length}
          publishing={publishing}
          onPublish={(opts) => void publish(opts)}
        />
      }
    >
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          {loading ? (
            <div
              className={cn('flex min-h-0 flex-1 flex-col gap-4', PANE_RHYTHM.body)}
              role="status"
              aria-label="Loading diff"
            >
              {Array.from({ length: 2 }).map((_, cardIndex) => (
                <div
                  key={cardIndex}
                  className="flex flex-col gap-1.5 rounded-md border border-border-soft p-3"
                >
                  <Skeleton className="h-3 w-40 rounded" />
                  <Skeleton className="h-3 w-3/4 rounded" />
                  <Skeleton className="h-3 w-1/2 rounded" />
                </div>
              ))}
            </div>
          ) : error != null ? (
            <div className={cn('flex min-h-0 flex-1 flex-col', PANE_RHYTHM.body)}>
              <ErrorStrip label="the diff" error={new Error(error)} onRetry={refresh} />
            </div>
          ) : files.length === 0 ? (
            <div className={cn('flex min-h-0 flex-1 flex-col', PANE_RHYTHM.body)}>
              <LensEmptyState
                tone={CONCEPT_TONE.diff}
                icon={CONCEPT_ICONS.diff}
                title="No changes in this pull request"
                description="The diff is empty, nothing to review."
              />
            </div>
          ) : (
            <ScrollFade className="min-h-0 flex-1">
              {files.map((file) => (
                <ReviewFileDiff
                  key={file.path}
                  file={file}
                  layoutMode={layoutMode}
                  drafts={draftsByPath.get(file.path) ?? EMPTY_ARRAY}
                  onAddDraft={(lineTarget, body) => void addDraftFromLine(lineTarget, body)}
                  onAskAgent={askAgent}
                />
              ))}
            </ScrollFade>
          )}
        </div>
        <ResizeHandle
          value={listWidth}
          min={260}
          max={560}
          onChange={setListWidth}
          onReset={() => setListWidth(320)}
          side="right"
          ariaLabel="Resize review list"
        />
        <div className="flex shrink-0 flex-col" style={{ width: listWidth }}>
          <DraftsPanel
            drafts={openDrafts}
            onEdit={(id, body) => void updateReviewDraft(id, body)}
            onDiscard={(id) => void discardReviewDraft(id)}
          />
        </div>
      </div>
    </StudioDetailLayout>
  );
};
