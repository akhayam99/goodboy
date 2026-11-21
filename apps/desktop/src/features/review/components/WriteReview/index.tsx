import { CHECK_STATE } from '../../../../store/slices/notifications/errorRecovery';
import { useEffect, useMemo } from 'react';
import { ErrorStrip, EmptyState, PageColumn, Skeleton } from '@goodboy/ui';
import type { PrReviewDraft, Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { DiffView, type DiffComments } from '../../../diff/components/DiffView';
import { useAskAgent } from '../../../diff/hooks/useAskAgent';
import { FILE_LEVEL_LINE } from '../../../../store/slices/review-drafts/fileLevel';
import { FILE_DRAFT_COMPOSER, draftThread } from '../../../diff/lib/draftThreads';
import { selectDisplayedMount } from '../../../../store/slices/project-mounts/selectors';
import { isDraftOnTarget } from '../../../../store/slices/review-drafts/resolveReviewTarget';
import { useMountReview } from '../../hooks/useMountReview';
import { useReviewDiff } from './useReviewDiff';
import { HostReviewNotice } from './HostReviewNotice';
import { ObjectOverflowMenu } from '../../../actions/components/ObjectOverflowMenu';
import { WriteReviewForm } from './WriteReviewForm';
import { ReviewPanelButton } from './ReviewPanelButton';
import { ReviewTargetChooser } from './ReviewTargetChooser';

type Props = {
  readonly session: Session;
};

const WRITE_REVIEW_ACTIONS_LABEL = 'Review actions';
const NO_DRAFTS: ReadonlyArray<PrReviewDraft> = [];

export const WriteReview = ({ session }: Props) => {
  const sessionId = session.id as SessionId;
  const menuTarget = useMemo(
    () => ({ kind: 'writeReview' as const, sessionId, draftId: null }),
    [sessionId],
  );
  const allDrafts = useAppStore((s) => s.reviewDrafts[sessionId] ?? NO_DRAFTS);
  const mountId = useAppStore(
    (s) => selectDisplayedMount({ state: s, sessionId })?.mountId ?? null,
  );
  const review = useMountReview({ sessionId, mountId });
  const reviewTarget = review.target;
  const loadReviewDrafts = useAppStore((s) => s.loadReviewDrafts);
  const addReviewDraft = useAppStore((s) => s.addReviewDraft);
  const updateReviewDraft = useAppStore((s) => s.updateReviewDraft);
  const discardReviewDraft = useAppStore((s) => s.discardReviewDraft);
  const reportError = useAppStore((s) => s.reportError);
  const askAgent = useAskAgent({ sessionId, preferKind: 'pr-reviewer' });
  const { files, loading, error, refresh } = useReviewDiff({ session, mountId });
  const drafts = useMemo(
    () =>
      reviewTarget === null
        ? NO_DRAFTS
        : allDrafts.filter(
            (draft) => draft.status === 'draft' && isDraftOnTarget({ draft, target: reviewTarget }),
          ),
    [allDrafts, reviewTarget],
  );

  useEffect(() => {
    void loadReviewDrafts(sessionId);
  }, [loadReviewDrafts, sessionId]);

  const comments = useMemo<DiffComments>(
    () => ({
      threads: drafts.map(draftThread),
      submitLabel: 'Add draft',
      composerLabel: 'Draft',
      allowFileLevel: true,
      fileComposer: FILE_DRAFT_COMPOSER,
      onSubmit: (filePath, anchor, body) => {
        if (reviewTarget === null) {
          return;
        }
        const end = anchor === null ? FILE_LEVEL_LINE : (anchor.endLineNumber ?? anchor.lineNumber);
        addReviewDraft({
          sessionId,
          target: reviewTarget,
          path: filePath,
          line: end,
          startLine: anchor !== null && end > anchor.lineNumber ? anchor.lineNumber : null,
          side: anchor?.side ?? 'new',
          body,
        }).catch((err: unknown) =>
          reportError({
            recovery: CHECK_STATE,
            title: "Couldn't save the review comment",
            error: err,
            sessionId,
          }),
        );
      },
      onAskAgent: askAgent,
      onEdit: (id, body) => updateReviewDraft(id, body),
      onDelete: (id) => void discardReviewDraft(id),
    }),
    [
      addReviewDraft,
      askAgent,
      discardReviewDraft,
      drafts,
      reportError,
      reviewTarget,
      sessionId,
      updateReviewDraft,
    ],
  );

  if (review.kind === 'onHost') {
    return (
      <PageColumn>
        <HostReviewNotice sessionId={sessionId} url={review.hostUrl} />
      </PageColumn>
    );
  }
  if (loading) {
    return (
      <PageColumn className="flex flex-col gap-3">
        <ReviewTargetChooser sessionId={sessionId} review={review} />
        {[0, 1].map((index) => (
          <div key={index} role="status" aria-label="Loading diff" className="flex flex-col gap-2">
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
      <PageColumn className="flex flex-col gap-3">
        <ReviewTargetChooser sessionId={sessionId} review={review} />
        <ErrorStrip labels={['the diff']} error={new Error(error)} onRetry={refresh} />
      </PageColumn>
    );
  }
  if (files.length === 0) {
    return (
      <PageColumn>
        <EmptyState
          size="section"
          tone={CONCEPT_TONE.diff}
          icon={CONCEPT_ICONS.diff}
          title="No changes in this pull request"
          description="The diff is empty. The verdict and the summary still go out."
        />
        <WriteReviewForm sessionId={sessionId} review={review} drafts={drafts} />
      </PageColumn>
    );
  }
  return (
    <DiffView
      files={files}
      comments={comments}
      columnWidth="full"
      toolbarEnd={
        <>
          <ReviewPanelButton sessionId={sessionId} review={review} drafts={drafts} />
          <ObjectOverflowMenu target={menuTarget} label={WRITE_REVIEW_ACTIONS_LABEL} />
        </>
      }
    />
  );
};
