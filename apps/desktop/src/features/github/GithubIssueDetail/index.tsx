import { PaneShell } from '@goodboy/ui';
import { RecordHeader } from '../../../shared/components/StudioDetail/RecordHeader';
import { RecordProperties } from '../../../shared/components/StudioDetail/RecordProperties';
import { RecordSections } from '../../../shared/components/StudioDetail/RecordSections';
import type { RecordSection } from '../../../shared/components/StudioDetail/RecordSections/types';
import type { RecordFrame } from '../../../shared/components/StudioDetail/RecordActions/types';
import { useMemo } from 'react';
import type { GithubIssue } from '@goodboy/types';
import { githubIssueFields, recordByline, resolveFacts } from '../../../shared/detail-fields';
import { DescriptionSection } from '../../../shared/components/DescriptionSection';
import { ToolImageScope } from '../../../shared/components/ToolImageScope';
import { useConversationPane } from '../../../shared/components/Conversation/useConversationPane';
import type { ConversationSource } from '../../../shared/components/Conversation/types';
import { GITHUB_ISSUE_CAPABILITIES, githubIssueConversation } from '../githubIssueConversation';
import { useGithubIssueComments } from '../useGithubIssueComments';
import {
  useGithubIssueDescription,
  type GithubIssueEditContext,
} from '../useGithubIssueDescription';

type Props = {
  readonly issue: GithubIssue;
  readonly frame?: RecordFrame | null;
  readonly editContext?: GithubIssueEditContext | null;
};

export const GithubIssueDetail = ({ issue, frame = null, editContext }: Props) => {
  const { description, save } = useGithubIssueDescription({ issue, editContext });
  const { comments, isLoading, error, reload, post } = useGithubIssueComments({
    workspaceId: editContext?.workspaceId ?? null,
    rootPath: editContext?.rootPath ?? null,
    issueNumber: issue.number,
  });
  const facts = useMemo(
    () => resolveFacts({ registry: githubIssueFields, entity: issue }),
    [issue],
  );

  const source = useMemo<ConversationSource>(
    () => ({
      toolLabel: 'GitHub issues',
      threads: githubIssueConversation({ comments }),
      capabilities: GITHUB_ISSUE_CAPABILITIES,
      isLoading,
      error,
      onRetry: reload,
      onPost: post == null ? null : ({ body }) => post(body),
      onResolve: null,
      resolveError: null,
      emptyDescription: 'This issue has no comments yet.',
      footnote: null,
      composerNote: null,
      renderMessageFooter: null,
    }),
    [comments, isLoading, error, reload, post],
  );
  const conversation = useConversationPane({ source, resetKey: issue.url });

  const descriptionContent = <DescriptionSection text={description} onSave={save} />;
  const sections: ReadonlyArray<RecordSection> = [
    {
      key: 'description',
      kind: 'description',
      label: 'Description',
      isCollapsible: false,
      defaultOpen: true,
      content:
        editContext == null ? (
          descriptionContent
        ) : (
          <ToolImageScope workspaceId={editContext.workspaceId} provider="github">
            {descriptionContent}
          </ToolImageScope>
        ),
    },
    ...(editContext != null ? [conversation.section] : []),
  ];

  return (
    <PaneShell
      scroll="body"
      dock={editContext != null ? conversation.composer : null}
      header={
        <RecordHeader
          provider="github"
          identifier={`#${issue.number}`}
          title={issue.title}
          byline={recordByline({
            lead: issue.author == null ? null : `Opened by ${issue.author}`,
            verb: 'updated',
            iso: issue.updatedAt,
          })}
          facts={<RecordProperties facts={facts} />}
          externalRef={{ url: issue.url, label: 'issue' }}
          frame={frame}
        />
      }
    >
      <RecordSections sections={sections} />
    </PaneShell>
  );
};
