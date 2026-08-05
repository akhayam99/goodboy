import { useMemo, useState } from 'react';
import { EmptyState, Markdown } from '@goodboy/ui';
import { FileDiff, FileText, ListChecks, MessageSquare } from 'lucide-react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import {
  DetailSection,
  HeaderBand,
  StudioDetailLayout,
  StudioDetailTabs,
} from '../../../../../shared/components/StudioDetail';
import {
  bitbucketPullRequestFields,
  resolveDetailFields,
} from '../../../../../shared/detail-fields';
import { IssueStateBadge, type StateTone } from '../../../../../shared/components/IssueStateBadge';
import { BranchPair } from '../../../../../shared/components/BranchPair';
import { ExternalRefActions } from '../../../../../shared/components/ExternalRefActions';
import { RefreshIconButton } from '../../../../../shared/components/RefreshIconButton';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../shared/components/conceptIcons';
import { slugifyBranch } from '../../../../../shared/utils/slugifyBranch';
import { openUrl } from '../../../../../shared/lib/editor';
import { PrChecks } from '../../../../github/components/GitHubStudio/PrChecks';
import { LaunchSessionPanel } from '../../../components/LaunchSessionPanel';
import { bitbucketPrIdentifier } from '../../bitbucketPrIdentifier';
import { bitbucketPrUrl } from '../../bitbucketPrUrl';
import { goalFromPullRequest } from '../../goal-from-pull-request';
import type { BitbucketPullRequest, BitbucketPullRequestState, BitbucketRepo } from '../../client';
import { PrChanges } from './PrChanges';
import { PrConversation } from './PrConversation';
import { useBitbucketPrDetail } from './useBitbucketPrDetail';
import { useBitbucketPrDiff } from './useBitbucketPrDiff';

type PrSection = 'overview' | 'changes' | 'checks' | 'conversation';

type Props = {
  readonly pullRequest: BitbucketPullRequest | null;
  readonly repo: BitbucketRepo | null;
  readonly sessionId: SessionId | null;
  readonly workspaceId: WorkspaceId;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly onRefresh: () => void;
  readonly onClose: () => void;
};

const STATE_TONE: Record<BitbucketPullRequestState, StateTone> = {
  OPEN: 'success',
  MERGED: 'info',
  DECLINED: 'danger',
  SUPERSEDED: 'neutral',
};

const SECTION_OPTIONS = [
  { value: 'overview', label: 'Overview', icon: FileText },
  { value: 'changes', label: 'Changes', icon: FileDiff },
  { value: 'checks', label: 'Checks', icon: ListChecks },
  { value: 'conversation', label: 'Conversation', icon: MessageSquare },
] as const;

const BRANCH_SLUG_MAX_LEN = 48;

export const PrDetailPanel = ({
  pullRequest,
  repo,
  sessionId,
  workspaceId,
  isLoading,
  error,
  onRefresh,
  onClose,
}: Props) => {
  const [section, setSection] = useState<PrSection>('overview');
  const target = useMemo(
    () => (repo == null || pullRequest == null ? null : { ...repo, pullRequestId: pullRequest.id }),
    [pullRequest, repo],
  );
  const detail = useBitbucketPrDetail({ target });
  const diff = useBitbucketPrDiff({ target, isEnabled: section === 'changes' });

  if (pullRequest == null || repo == null) {
    return (
      <div className="flex h-full items-center justify-center px-8">
        <EmptyState
          bordered
          tone={CONCEPT_TONE.bitbucket}
          icon={CONCEPT_ICONS.bitbucket}
          title="No pull request selected"
          description="Pick a pull request to see its description, checks and changes."
          size="lg"
          headingLevel={2}
        />
      </div>
    );
  }

  const webUrl = bitbucketPrUrl({ repo, pullRequest });
  const identifier = bitbucketPrIdentifier({ repo, pullRequest });

  return (
    <StudioDetailLayout
      header={
        <HeaderBand
          meta={
            <IssueStateBadge tone={STATE_TONE[pullRequest.state]}>
              #{pullRequest.id} · {pullRequest.state.toLowerCase()}
            </IssueStateBadge>
          }
          title={pullRequest.title}
          subtitle={
            <BranchPair
              headBranch={pullRequest.sourceBranch}
              baseBranch={pullRequest.destinationBranch}
            />
          }
          actions={
            <>
              <RefreshIconButton
                label="refresh pull request"
                iconSize={12}
                isLoading={isLoading}
                error={error}
                onClick={() => {
                  detail.reload();
                  onRefresh();
                }}
              />
              <ExternalRefActions url={webUrl} label="pull request" hostLabel="Bitbucket" />
            </>
          }
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
      properties={resolveDetailFields({
        registry: bitbucketPullRequestFields,
        entity: pullRequest,
      })}
    >
      {section === 'overview' && (
        <>
          <DetailSection label="description" variant="frameless">
            {pullRequest.description !== '' ? (
              <Markdown text={pullRequest.description} className="text-sm leading-relaxed" />
            ) : (
              <p className="text-sm italic text-muted-foreground/60">No description.</p>
            )}
          </DetailSection>
          <LaunchSessionPanel
            key={identifier}
            workspaceId={workspaceId}
            linkedSessionId={sessionId}
            goalSeed={goalFromPullRequest({ pullRequest })}
            branchSlugSeed={slugifyBranch({
              input: pullRequest.title,
              maxLength: BRANCH_SLUG_MAX_LEN,
            })}
            externalTask={{
              provider: 'bitbucket',
              externalId: identifier,
              identifier,
              url: webUrl,
              title: pullRequest.title,
            }}
            onClose={onClose}
          />
        </>
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
          onRetry={detail.reload}
        />
      )}
    </StudioDetailLayout>
  );
};
