import type { PullRequestPort, PullRequestReviewerGroups } from '@goodboy/core/review-source';
import type {
  MountId,
  PrComment,
  PullRequestState,
  PullRequestView,
  SessionId,
} from '@goodboy/types';
import type { ThreadEntry } from '../../../resolve/commentGroupsView';
import { Person } from '../../../../shared/components/Person';
import { BotsProperty } from './BotsProperty';
import { PROPERTY_ROW as ROW } from './propertyRow';
import { PropertyField } from './PropertyField';
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
  readonly comments: ReadonlyArray<PrComment> | null;
  readonly entries: ReadonlyArray<ThreadEntry>;
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
  comments,
  entries,
  isLoaded,
  canEdit,
  onMutated,
}: Props) => (
  <div
    aria-label="Properties"
    role="group"
    data-slot="side-column"
    className="flex min-w-0 flex-wrap gap-x-8 gap-y-4 @[880px]:flex-col @[880px]:flex-nowrap @[880px]:gap-6"
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
    <BotsProperty bots={reviewers.bots} comments={comments} entries={entries} />
    <ResolvesProperty
      sessionId={sessionId}
      mountId={mountId}
      pr={pr}
      view={view}
      canEdit={canEdit}
    />
    {pr.author == null ? null : (
      <PropertyField label="Author">
        <div className={ROW}>
          <Person login={pr.author.login} avatarUrl={pr.author.avatarUrl} size="sm" />
        </div>
      </PropertyField>
    )}
  </div>
);
