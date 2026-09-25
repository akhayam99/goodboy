import { RecordDetailEmptyState } from '../../../../../shared/components/StudioDetail';
import { PaneShell } from '../../../../../shared/components/PaneShell';
import { RecordHeader } from '../../../../../shared/components/StudioDetail/RecordHeader';
import { RecordFacts } from '../../../../../shared/components/StudioDetail/RecordFacts';
import { RecordSections } from '../../../../../shared/components/StudioDetail/RecordSections';
import type { RecordSection } from '../../../../../shared/components/StudioDetail/RecordSections/types';
import type { RecordFrame } from '../../../../../shared/components/StudioDetail/RecordActions/types';
import { DescriptionSection } from '../../../../../shared/components/DescriptionSection';
import { useMemo } from 'react';
import { Notice } from '@goodboy/ui';
import type { BitbucketIntegrationBinding, FileDiff, SessionId, WorkspaceId } from '@goodboy/types';
import { bitbucketPullRequestFields, resolveFacts } from '../../../../../shared/detail-fields';
import { checksRollup } from '../../../../github/components/PullRequest/checksRollup';
import { openUrl } from '../../../../../shared/lib/editor';
import { PrChecks } from '../../../../github/components/PullRequest/PrChecks';
import { bitbucketPrIdentifier } from '../../bitbucketPrIdentifier';
import { bitbucketPrUrl } from '../../bitbucketPrUrl';
import { BitbucketStateChip } from '../../BitbucketStateChip';
import type { BitbucketPullRequest, BitbucketRepo } from '../../client';
import { useAppStore } from '../../../../../store';
import { usePrVerbs } from '../usePrVerbs';
import { useConversationPane } from '../../../../../shared/components/Conversation/useConversationPane';
import type { ConversationSource } from '../../../../../shared/components/Conversation/types';
import { BITBUCKET_PR_CAPABILITIES, bitbucketConversation } from '../../bitbucketConversation';
import { PrChanges } from './PrChanges';
import { useBitbucketPrDetail } from './useBitbucketPrDetail';
import { useBitbucketPrDiff } from './useBitbucketPrDiff';
import { usePrActions } from './usePrActions';

type ChangesSummaryParams = {
  readonly files: ReadonlyArray<FileDiff>;
};

const changesSummary = ({ files }: ChangesSummaryParams): string | undefined => {
  if (files.length === 0) {
    return undefined;
  }
  const added = files.reduce((sum, file) => sum + file.additions, 0);
  const removed = files.reduce((sum, file) => sum + file.deletions, 0);
  return `${files.length} ${files.length === 1 ? 'file' : 'files'} +${added} −${removed}`;
};

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
  const target = useMemo(
    () => (repo == null || pullRequest == null ? null : { ...repo, pullRequestId: pullRequest.id }),
    [pullRequest, repo],
  );
  const detail = useBitbucketPrDetail({ target });
  const diff = useBitbucketPrDiff({ target, isEnabled: true });
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

  const comment = actions.comment;
  const reply = actions.reply;
  const source = useMemo<ConversationSource>(
    () => ({
      toolLabel: 'Bitbucket',
      threads: bitbucketConversation({ comments: detail.comments }),
      capabilities: BITBUCKET_PR_CAPABILITIES,
      isLoading: detail.isLoading,
      error: detail.error,
      onRetry: detail.reload,
      onPost:
        comment == null || reply == null
          ? null
          : ({ body, threadId }) =>
              threadId == null ? comment(body) : reply({ parentCommentId: Number(threadId), body }),
      onResolve: null,
      resolveError: null,
      emptyDescription: 'Comments on this pull request show up here.',
      footnote: actions.canAct ? null : POST_BLOCKED,
      composerNote: null,
      renderMessageFooter: null,
    }),
    [
      detail.comments,
      detail.isLoading,
      detail.error,
      detail.reload,
      comment,
      reply,
      actions.canAct,
    ],
  );
  const conversation = useConversationPane({
    source,
    resetKey: target == null ? 'none' : JSON.stringify(target),
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

  const sections: ReadonlyArray<RecordSection> = [
    {
      key: 'description',
      kind: 'description',
      label: 'Description',
      isCollapsible: false,
      defaultOpen: true,
      content: <DescriptionSection text={pullRequest.description} />,
    },
    {
      key: 'checks',
      kind: 'tool',
      label: 'Checks',
      summary: checksRollup({ checks: detail.checks }),
      isCollapsible: true,
      defaultOpen: false,
      content: (
        <PrChecks
          checks={detail.checks}
          fallbackUrl={webUrl}
          hostLabel="Bitbucket"
          onOpenUrl={(url) => void openUrl(url)}
        />
      ),
    },
    {
      key: 'changes',
      kind: 'tool',
      label: 'Changes',
      summary: changesSummary({ files: diff.files }),
      isCollapsible: true,
      defaultOpen: false,
      content: (
        <PrChanges
          files={diff.files}
          isLoading={diff.isLoading}
          error={diff.error}
          onRetry={diff.reload}
        />
      ),
    },
    conversation.section,
  ];

  return (
    <PaneShell
      scroll="body"
      dock={conversation.composer}
      header={
        <RecordHeader
          provider="bitbucket"
          identifier={identifier}
          title={pullRequest.title}
          state={<BitbucketStateChip state={pullRequest.state} />}
          facts={
            <RecordFacts
              facts={resolveFacts({ registry: bitbucketPullRequestFields, entity: pullRequest })}
            />
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
    >
      {error != null ? (
        <Notice
          tone="warning"
          placement="inline"
          title="Couldn't refresh the pull requests"
          body={error}
        />
      ) : null}
      <RecordSections sections={sections} />
    </PaneShell>
  );
};
