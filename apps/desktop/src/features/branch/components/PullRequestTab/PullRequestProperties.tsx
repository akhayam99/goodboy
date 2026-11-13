import type { PullRequestPort, PullRequestReviewerGroups } from '@goodboy/core/review-source';
import type {
  MountId,
  PrComment,
  PrReview,
  PullRequestState,
  PullRequestView,
  SessionId,
} from '@goodboy/types';
import type { ChecksSummary } from '../../../integrations/github/checksRollup';
import { ChecksProperty } from './ChecksProperty';
import { PeopleProperty } from './PeopleProperty';
import { ResolvesProperty } from './ResolvesProperty';
import { ReviewersProperty, type ReviewerRequest } from './ReviewersProperty';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
  readonly pr: PullRequestState;
  readonly view: PullRequestView | null;
  readonly port: PullRequestPort | null;
  readonly request: ReviewerRequest;
  readonly reviewers: PullRequestReviewerGroups;
  readonly checks: ChecksSummary | null;
  readonly comments: ReadonlyArray<PrComment> | null;
  readonly reviews: ReadonlyArray<Pick<PrReview, 'author' | 'state' | 'body'>>;
  readonly isLoaded: boolean;
  readonly canEdit: boolean;
  readonly onMutated: () => void;
};

export const PullRequestProperties = ({
  sessionId,
  mountId,
  pr,
  view,
  port,
  request,
  reviewers,
  checks,
  comments,
  reviews,
  isLoaded,
  canEdit,
  onMutated,
}: Props) => (
  <div
    aria-label="Properties"
    role="group"
    data-slot="side-column"
    className="flex min-w-0 flex-wrap gap-x-8 gap-y-6 @[880px]:flex-col @[880px]:flex-nowrap"
  >
    <ReviewersProperty
      sessionId={sessionId}
      mountId={mountId}
      prNumber={pr.number}
      people={reviewers.people}
      bots={reviewers.bots}
      isLoaded={isLoaded}
      port={port}
      request={request}
      onMutated={onMutated}
    />
    <ChecksProperty summary={checks} />
    <PeopleProperty
      author={pr.author}
      bots={reviewers.bots}
      comments={comments}
      reviews={reviews}
    />
    <ResolvesProperty
      sessionId={sessionId}
      mountId={mountId}
      pr={pr}
      view={view}
      canEdit={canEdit}
    />
  </div>
);
