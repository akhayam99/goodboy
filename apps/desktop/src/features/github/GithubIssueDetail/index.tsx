import { PaneShell } from '../../../shared/components/PaneShell';
import { RecordHeader } from '../../../shared/components/StudioDetail/RecordHeader';
import { RecordFacts } from '../../../shared/components/StudioDetail/RecordFacts';
import { RecordSections } from '../../../shared/components/StudioDetail/RecordSections';
import type { RecordSection } from '../../../shared/components/StudioDetail/RecordSections/types';
import type { RecordFrame } from '../../../shared/components/StudioDetail/RecordActions/types';
import { useMemo } from 'react';
import type { GithubIssue } from '@goodboy/types';
import { StateBadge } from '@goodboy/ui';
import { githubIssueFields, resolveFacts } from '../../../shared/detail-fields';
import { DescriptionSection } from '../../../shared/components/DescriptionSection';
import { stateWord } from '../../inbox/stateWord';
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

  const sections: ReadonlyArray<RecordSection> = [
    {
      key: 'description',
      kind: 'description',
      label: 'Description',
      isCollapsible: false,
      defaultOpen: true,
      content: <DescriptionSection text={description} onSave={save} />,
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
          state={<StateBadge>{stateWord({ value: issue.state })}</StateBadge>}
          facts={<RecordFacts facts={facts} />}
          externalRef={{ url: issue.url, label: 'issue' }}
          frame={frame}
        />
      }
    >
      <RecordSections sections={sections} />
    </PaneShell>
  );
};
