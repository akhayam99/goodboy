import { RecordDetailEmptyState } from '../../../../../shared/components/StudioDetail';
import { RecordHeader } from '../../../../../shared/components/StudioDetail/RecordHeader';
import type { RecordFrame } from '../../../../../shared/components/StudioDetail/RecordActions/types';
import { DetailProperties } from '../../../../../shared/components/StudioDetail/DetailProperties';
import { PaneShell } from '../../../../../shared/components/PaneShell';
import { useMemo, useState } from 'react';
import { Markdown, Notice } from '@goodboy/ui';
import { FileDiff, FileText, ListChecks, MessageSquare } from 'lucide-react';
import type { BitbucketIntegrationBinding, SessionId, WorkspaceId } from '@goodboy/types';
import { StudioWidget, StudioDetailTabs } from '@goodboy/ui';
import {
  bitbucketPullRequestFields,
  resolveDetailFields,
} from '../../../../../shared/detail-fields';
import { BranchPair } from '@goodboy/ui';
import { openUrl } from '../../../../../shared/lib/editor';
import { PrChecks } from '../../../../github/components/PullRequest/PrChecks';
import { bitbucketPrIdentifier } from '../../bitbucketPrIdentifier';
import { bitbucketPrUrl } from '../../bitbucketPrUrl';
import { BitbucketStateChip } from '../../BitbucketStateChip';
import type { BitbucketPullRequest, BitbucketRepo } from '../../client';
import { useAppStore } from '../../../../../store';
import { usePrVerbs } from '../usePrVerbs';
import { voteSummary } from '../usePrVerbs/voteSummary';
import { bitbucketPrVote } from '../usePrVerbs/bitbucketPrVote';
import { PrChanges } from './PrChanges';
import { PrConversation } from './PrConversation';
import { useBitbucketPrDetail } from './useBitbucketPrDetail';
import { useBitbucketPrDiff } from './useBitbucketPrDiff';
import { usePrActions } from './usePrActions';

type PrSection = 'overview' | 'changes' | 'checks' | 'conversation';

type Props = {
  readonly pullRequest: BitbucketPullRequest | null;
  readonly repo: BitbucketRepo | null;
  readonly sessionId: SessionId | null;
  readonly workspaceId: WorkspaceId;
  readonly error: string | null;
  readonly onRefresh: () => void;
  readonly onClose: () => void;
  readonly frame?: RecordFrame | null;
};

const SECTION_OPTIONS = [
  { value: 'overview', label: 'Overview', icon: FileText },
  { value: 'changes', label: 'Changes', icon: FileDiff },
  { value: 'checks', label: 'Checks', icon: ListChecks },
  { value: 'conversation', label: 'Conversation', icon: MessageSquare },
] as const;

const POST_BLOCKED =
  'Goodboy is still resolving this pull request on Bitbucket, so it cannot post a comment yet';

export const PrDetailPanel = ({
  pullRequest,
  repo,
  sessionId,
  workspaceId,
  error,
  onRefresh,
  frame = null,
}: Props) => {
  const [section, setSection] = useState<PrSection>('overview');
  const target = useMemo(
    () => (repo == null || pullRequest == null ? null : { ...repo, pullRequestId: pullRequest.id }),
    [pullRequest, repo],
  );
  const detail = useBitbucketPrDetail({ target });
  const diff = useBitbucketPrDiff({ target, isEnabled: section === 'changes' });
  const config = useAppStore((state) => {
    const integration = (state.workspaceIntegrations[workspaceId] ?? []).find(
      (candidate): candidate is BitbucketIntegrationBinding => candidate.provider === 'bitbucket',
    );
    return integration?.config ?? null;
  });
  const actions = usePrActions({
    sessionId,
    repo,
    pullRequestId: pullRequest?.id ?? null,
    onWritten: () => {
      detail.reload();
      onRefresh();
    },
  });
  const verbs = usePrVerbs({
    pullRequest,
    accountId: config?.accountId ?? null,
    displayName: config?.displayName ?? null,
    busy: actions.busy,
    canAct: actions.canAct,
    onApprove: actions.approve,
    onUnapprove: actions.unapprove,
    onRequestChanges: actions.requestChanges,
    onWithdrawChanges: actions.withdrawChanges,
    onMerge: actions.merge,
    onDecline: actions.decline,
  });

  if (pullRequest == null || repo == null) {
    return (
      <RecordDetailEmptyState
        provider="bitbucket"
        title="No pull request selected"
        description="Pick a pull request to see its description, checks and changes."
      />
    );
  }

  const webUrl = bitbucketPrUrl({ repo, pullRequest });
  const identifier = bitbucketPrIdentifier({ repo, pullRequest });

  return (
    <PaneShell
      scroll="body"
      header={
        <RecordHeader
          provider="bitbucket"
          identifier={identifier}
          title={pullRequest.title}
          state={<BitbucketStateChip state={pullRequest.state} />}
          facts={
            <div className="flex flex-col gap-1">
              <BranchPair
                headBranch={pullRequest.sourceBranch}
                baseBranch={pullRequest.destinationBranch}
              />
              <p className="text-2xs text-muted-foreground">
                {voteSummary({
                  participants: pullRequest.participants,
                  vote: bitbucketPrVote({
                    participants: pullRequest.participants,
                    accountId: config?.accountId ?? null,
                    displayName: config?.displayName ?? null,
                  }),
                })}
              </p>
            </div>
          }
          externalRef={{ url: webUrl, label: 'pull request' }}
          verbs={verbs}
          frame={frame}
          onRefresh={() => {
            detail.reload();
            onRefresh();
          }}
        />
      }
      tabs={
        <StudioDetailTabs
          ariaLabel="Pull request sections"
          options={SECTION_OPTIONS}
          value={section}
          onChange={setSection}
        />
      }
    >
      {error != null ? (
        <Notice
          tone="warning"
          placement="inline"
          title="Couldn't refresh the pull requests"
          body={error}
        />
      ) : null}
      <DetailProperties
        entries={resolveDetailFields({
          registry: bitbucketPullRequestFields,
          entity: pullRequest,
        })}
      />
      {section === 'overview' && (
        <StudioWidget presentation="section" label="description" variant="frameless">
          {pullRequest.description !== '' ? (
            <Markdown text={pullRequest.description} className="text-sm leading-relaxed" />
          ) : (
            <p className="text-sm italic text-faint-foreground">No description.</p>
          )}
        </StudioWidget>
      )}
      {section === 'changes' && (
        <PrChanges
          files={diff.files}
          isLoading={diff.isLoading}
          error={diff.error}
          onRetry={diff.reload}
        />
      )}
      {section === 'checks' && (
        <PrChecks
          checks={detail.checks}
          fallbackUrl={webUrl}
          hostLabel="Bitbucket"
          onOpenUrl={(url) => void openUrl(url)}
        />
      )}
      {section === 'conversation' && (
        <PrConversation
          comments={detail.comments}
          isLoading={detail.isLoading}
          error={detail.error}
          postBlockReason={actions.canAct ? null : POST_BLOCKED}
          onRetry={detail.reload}
          onPost={actions.comment}
          onReply={actions.reply}
        />
      )}
    </PaneShell>
  );
};
