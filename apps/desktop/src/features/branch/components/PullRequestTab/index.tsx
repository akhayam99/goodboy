import type { PullRequestFailureKind } from '@goodboy/core';
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
import { useBranchSummaryDiff } from '../../hooks/useBranchSummaryDiff';
import type { BranchStart } from '../../hooks/useBranchStart';
import type { PullRequestReadiness } from '../../hooks/usePullRequestReadiness';
import type { PullRequestBranchFacts } from './pullRequestCellsOf';
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
  readonly commits: ReadonlyArray<BranchCommit>;
  readonly diffRevision: number | string;
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
  commits,
  diffRevision,
  canEdit,
  request,
  isConnected,
  onMutated,
  onCreated,
  onConnected,
  onReload,
  onSelectTab,
}: Props) => {
  const summaryDiff = useBranchSummaryDiff({
    sessionId: session.id,
    worktreePath: mountPath,
    revision: diffRevision,
  });
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
        cells={start.cells}
        commits={commits}
        files={summaryDiff.files}
        isDiffLoading={summaryDiff.isLoading}
        diffError={summaryDiff.error}
        onRetryDiff={summaryDiff.retry}
        conflictFiles={start.conflictFiles}
        isConnected={isConnected}
        onConnected={onConnected}
        onCreated={onCreated}
        onSelectTab={onSelectTab}
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
      detail={detail}
      view={view}
      edits={edits}
      viewError={viewError}
      viewErrorKind={viewErrorKind}
      canEdit={canEdit}
      request={request}
      commits={commits}
      files={summaryDiff.files}
      isDiffLoading={summaryDiff.isLoading}
      diffError={summaryDiff.error}
      onRetryDiff={summaryDiff.retry}
      onMutated={onMutated}
      onReload={onReload}
      onSelectTab={onSelectTab}
    />
  );
};
