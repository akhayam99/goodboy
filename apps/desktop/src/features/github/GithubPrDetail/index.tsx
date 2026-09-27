import { PaneShell } from '../../../shared/components/PaneShell';
import { RecordHeader } from '../../../shared/components/StudioDetail/RecordHeader';
import { RecordProperties } from '../../../shared/components/StudioDetail/RecordProperties';
import { RecordSections } from '../../../shared/components/StudioDetail/RecordSections';
import type { RecordSection } from '../../../shared/components/StudioDetail/RecordSections/types';
import type { RecordFrame } from '../../../shared/components/StudioDetail/RecordActions/types';
import { useMemo } from 'react';
import type { GithubInboxPrRole, PullRequestState, WorkspaceId } from '@goodboy/types';
import { githubPullRequestFields, recordByline, resolveFacts } from '../../../shared/detail-fields';
import { DescriptionSection } from '../../../shared/components/DescriptionSection';
import { useConversationPane } from '../../../shared/components/Conversation/useConversationPane';
import type { ConversationSource } from '../../../shared/components/Conversation/types';
import { PullRequestChip } from '../components/PullRequestChip';
import { GITHUB_ISSUE_CAPABILITIES, githubIssueConversation } from '../githubIssueConversation';
import { useGithubIssueComments } from '../useGithubIssueComments';

const ROLE_LEAD: Readonly<Record<GithubInboxPrRole, string>> = {
  'review-requested': 'Your review is requested',
  author: 'Your pull request',
};

const NO_CHECKS = [] as const;

type Props = {
  readonly pr: PullRequestState;
  readonly role: GithubInboxPrRole;
  readonly workspaceId: WorkspaceId;
  readonly rootPath: string;
  readonly frame?: RecordFrame | null;
  readonly onRefresh?: (() => void) | null;
};

export const GithubPrDetail = ({
  pr,
  role,
  workspaceId,
  rootPath,
  frame = null,
  onRefresh = null,
}: Props) => {
  const { comments, isLoading, error, reload, post } = useGithubIssueComments({
    workspaceId,
    rootPath,
    issueNumber: pr.number,
  });
  const facts = useMemo(
    () => resolveFacts({ registry: githubPullRequestFields, entity: { pr, checks: NO_CHECKS } }),
    [pr],
  );

  const source = useMemo<ConversationSource>(
    () => ({
      toolLabel: 'GitHub',
      threads: githubIssueConversation({ comments }),
      capabilities: GITHUB_ISSUE_CAPABILITIES,
      isLoading,
      error,
      onRetry: reload,
      onPost: post == null ? null : ({ body }) => post(body),
      onResolve: null,
      resolveError: null,
      emptyDescription: 'This pull request has no comments yet.',
      footnote: null,
      composerNote: null,
      renderMessageFooter: null,
    }),
    [comments, isLoading, error, reload, post],
  );
  const conversation = useConversationPane({ source, resetKey: pr.url });

  const sections: ReadonlyArray<RecordSection> = [
    {
      key: 'description',
      kind: 'description',
      label: 'Description',
      isCollapsible: false,
      defaultOpen: true,
      content: <DescriptionSection text={pr.body} />,
    },
    conversation.section,
  ];

  const refresh = () => {
    reload();
    onRefresh?.();
  };

  return (
    <PaneShell
      scroll="body"
      dock={conversation.composer}
      header={
        <RecordHeader
          provider="github"
          identifier={`#${pr.number}`}
          title={pr.title}
          state={<PullRequestChip state={pr.state} variant="badge" />}
          byline={recordByline({ lead: ROLE_LEAD[role], verb: 'updated', iso: pr.updatedAt })}
          facts={<RecordProperties facts={facts} />}
          externalRef={{ url: pr.url, label: 'PR' }}
          frame={frame}
          onRefresh={refresh}
        />
      }
    >
      <RecordSections sections={sections} />
    </PaneShell>
  );
};
