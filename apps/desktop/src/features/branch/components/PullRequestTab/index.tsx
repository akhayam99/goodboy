import type { PullRequestFailureKind } from '@goodboy/core/review-source';
import type {
  BranchCommit,
  MountId,
  PullRequestHost,
  PrDetail,
  PullRequestState,
  PullRequestView,
  Session,
} from '@goodboy/types';
import type { PullRequestEdit } from '../../../../store/slices/pull-request-view/state';
import type { BranchTab } from '../../../../store/slices/navigation/types';
import type { ThreadEntry } from '../../../resolve/commentGroupsView';
import type { BranchStart } from '../../hooks/useBranchStart';
import type { PullRequestReadiness } from '../../hooks/usePullRequestReadiness';
import type { PullRequestBranchFacts } from './MergeBox/mergeBoxOf';
import { BitbucketNoPullRequest } from './BitbucketNoPullRequest';
import { BranchStartPage } from './BranchStartPage';
import { PullRequestPage } from './PullRequestPage';
import type { ReviewerRequest } from './ReviewersProperty';

type Props = {
  readonly session: Session;
  readonly host: PullRequestHost;
  readonly pr: PullRequestState | null;
  readonly isBitbucketRemote: boolean;
  readonly isBitbucketConnected: boolean;
  readonly newPullRequestUrl: string | null;
  readonly detail: PrDetail | null;
  readonly view: PullRequestView | null;
  readonly edits: ReadonlyArray<PullRequestEdit>;
  readonly viewError: string | null;
  readonly viewErrorKind: PullRequestFailureKind | null;
  readonly mountPath: string | null;
  readonly branch: string | null;
  readonly start: BranchStart;
  readonly mountId: MountId | null;
  readonly readiness: PullRequestReadiness;
  readonly branchFacts: PullRequestBranchFacts;
  readonly mergeWord: string;
  readonly entries: ReadonlyArray<ThreadEntry>;
  readonly commits: ReadonlyArray<BranchCommit>;
  readonly canEdit: boolean;
  readonly request: ReviewerRequest;
  readonly isConnected: boolean;
  readonly onMutated: () => void;
  readonly onCreated: () => void;
  readonly onConnected: () => void;
  readonly onReload: () => void;
  readonly onSelectTab: (tab: BranchTab) => void;
};

export const PullRequestTab = ({
  session,
  host,
  pr,
  isBitbucketRemote,
  isBitbucketConnected,
  newPullRequestUrl,
  detail,
  view,
  edits,
  viewError,
  viewErrorKind,
  mountPath,
  branch,
  start,
  mountId,
  readiness,
  branchFacts,
  mergeWord,
  entries,
  commits,
  canEdit,
  request,
  isConnected,
  onMutated,
  onCreated,
  onConnected,
  onReload,
  onSelectTab,
}: Props) => {
  if (pr === null) {
    return (
      <BranchStartPage
        hostForm={
          isBitbucketRemote ? (
            <BitbucketNoPullRequest url={newPullRequestUrl} isConnected={isBitbucketConnected} />
          ) : null
        }
        session={session}
        mountPath={mountPath}
        branch={branch}
        step={start.step}
        configuredBase={start.configuredBase}
        commits={commits}
        conflictFiles={start.conflictFiles}
        isConnected={isConnected}
        onConnected={onConnected}
        onCreated={onCreated}
      />
    );
  }
  return (
    <PullRequestPage
      session={session}
      host={host}
      pr={pr}
      mountId={mountId}
      readiness={readiness}
      branch={branchFacts}
      mergeWord={mergeWord}
      entries={entries}
      detail={detail}
      view={view}
      edits={edits}
      viewError={viewError}
      viewErrorKind={viewErrorKind}
      canEdit={canEdit}
      request={request}
      onMutated={onMutated}
      onReload={onReload}
      onSelectTab={onSelectTab}
    />
  );
};
