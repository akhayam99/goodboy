import { useEffect, useMemo } from 'react';
import { ErrorStrip, LensEmptyState, PageColumn, RefreshIconButton, Skeleton } from '@goodboy/ui';
import type { PrReviewDraft, Session, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../shared/components/conceptIcons';
import { DiffView, type DiffComments } from '../../../../diff/components/DiffView';
import { useAskAgent } from '../../../../diff/hooks/useAskAgent';
import { draftThread } from './draftThreads';
import { useReviewDiff } from './useReviewDiff';

type Props = {
  readonly session: Session;
};

export const WriteReview = ({ session }: Props) => {
  const sessionId = session.id as SessionId;
  const drafts = useAppStore(
    (s) => s.reviewDrafts[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<PrReviewDraft>),
  );
  const loadReviewDrafts = useAppStore((s) => s.loadReviewDrafts);
  const addReviewDraft = useAppStore((s) => s.addReviewDraft);
  const updateReviewDraft = useAppStore((s) => s.updateReviewDraft);
  const discardReviewDraft = useAppStore((s) => s.discardReviewDraft);
  const reportError = useAppStore((s) => s.reportError);
  const askAgent = useAskAgent({ sessionId, preferKind: 'pr-reviewer' });
  const { files, loading, error, refresh } = useReviewDiff({ session });

  useEffect(() => {
    void loadReviewDrafts(sessionId);
  }, [loadReviewDrafts, sessionId]);

  const comments = useMemo<DiffComments>(
    () => ({
      threads: drafts.filter((draft) => draft.status === 'draft').map(draftThread),
      submitLabel: 'Add draft',
      composerLabel: 'Draft',
      allowFileLevel: false,
      onSubmit: (filePath, anchor, body) => {
        if (anchor === null) {
          return;
        }
        const end = anchor.endLineNumber ?? anchor.lineNumber;
        addReviewDraft({
          sessionId,
          path: filePath,
          line: end,
          startLine: end > anchor.lineNumber ? anchor.lineNumber : null,
          side: anchor.side,
          body,
        }).catch((err: unknown) =>
          reportError({ title: "Couldn't save the review comment", error: err, sessionId }),
        );
      },
      onAskAgent: askAgent,
      onEdit: (id, body) => void updateReviewDraft(id, body),
      onDelete: (id) => void discardReviewDraft(id),
    }),
    [
      addReviewDraft,
      askAgent,
      discardReviewDraft,
      drafts,
      reportError,
      sessionId,
      updateReviewDraft,
    ],
  );

  if (loading) {
    return (
      <PageColumn className="flex flex-col gap-3">
        {[0, 1].map((index) => (
          <div
            key={index}
            role="status"
            aria-label="Loading diff"
            className="flex flex-col gap-1.5"
          >
            <Skeleton className="h-9 w-full rounded-md" />
            <Skeleton className="h-3 w-3/4 rounded-sm" />
            <Skeleton className="h-3 w-1/2 rounded-sm" />
          </div>
        ))}
      </PageColumn>
    );
  }
  if (error != null) {
    return (
      <PageColumn>
        <ErrorStrip label="the diff" error={new Error(error)} onRetry={refresh} />
      </PageColumn>
    );
  }
  if (files.length === 0) {
    return (
      <PageColumn>
        <LensEmptyState
          tone={CONCEPT_TONE.diff}
          icon={CONCEPT_ICONS.diff}
          title="No changes in this pull request"
          description="The diff is empty, nothing to review."
        />
      </PageColumn>
    );
  }
  return (
    <DiffView
      files={files}
      comments={comments}
      toolbarEnd={
        <RefreshIconButton
          label="Refresh diff"
          isLoading={loading}
          onClick={refresh}
          iconSize={12}
          className="size-6 border-transparent p-0"
        />
      }
    />
  );
};
