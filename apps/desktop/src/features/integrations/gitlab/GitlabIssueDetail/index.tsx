import { PaneShell } from '../../../../shared/components/PaneShell';
import { RecordHeader } from '../../../../shared/components/StudioDetail/RecordHeader';
import { RecordFacts } from '../../../../shared/components/StudioDetail/RecordFacts';
import { RecordSections } from '../../../../shared/components/StudioDetail/RecordSections';
import type { RecordFrame } from '../../../../shared/components/StudioDetail/RecordActions/types';
import { useMemo } from 'react';
import type { ProjectId, WorkspaceId } from '@goodboy/types';
import { StateBadge } from '@goodboy/ui';
import { DescriptionSection } from '../../../../shared/components/DescriptionSection';
import { gitlabIssueFields, resolveFacts } from '../../../../shared/detail-fields';
import { stateWord } from '../../../inbox/stateWord';
import { issueIdentifier, type GitlabIssue } from '../client';
import { useGitlabIssueDescription } from '../useGitlabIssueDescription';
import { useGitlabIssueNotes } from '../useGitlabIssueNotes';
import { useConversationPane } from '../../../../shared/components/Conversation/useConversationPane';
import type { ConversationSource } from '../../../../shared/components/Conversation/types';
import { GITLAB_ISSUE_CAPABILITIES, gitlabIssueConversation } from '../gitlabIssueConversation';
import { systemNoteFootnote } from '../systemNoteFootnote';

type Props = {
  readonly issue: GitlabIssue;
  readonly workspaceId: WorkspaceId;
  readonly projectId?: ProjectId;
  readonly frame?: RecordFrame | null;
};

export const GitlabIssueDetail = ({ issue, workspaceId, projectId, frame = null }: Props) => {
  const { description, save } = useGitlabIssueDescription({ issue, workspaceId, projectId });
  const {
    notes: noteList,
    isLoading,
    error,
    reload,
    post,
  } = useGitlabIssueNotes({ issue, workspaceId, projectId });
  const source = useMemo<ConversationSource>(() => {
    const conversation = gitlabIssueConversation({ notes: noteList });
    return {
      toolLabel: 'GitLab issues',
      threads: conversation.threads,
      capabilities: GITLAB_ISSUE_CAPABILITIES,
      isLoading,
      error,
      onRetry: reload,
      onPost: post == null ? null : ({ body }) => post(body),
      onResolve: null,
      resolveError: null,
      emptyDescription: 'Notes on this issue show up here.',
      footnote: systemNoteFootnote({ count: conversation.systemNoteCount }),
      composerNote: null,
      renderMessageFooter: null,
    };
  }, [noteList, isLoading, error, reload, post]);
  const conversation = useConversationPane({ source, resetKey: issue.webUrl });

  return (
    <PaneShell
      scroll="body"
      dock={conversation.composer}
      header={
        <RecordHeader
          provider="gitlab"
          identifier={issueIdentifier(issue)}
          title={issue.title}
          state={<StateBadge>{stateWord({ value: issue.state })}</StateBadge>}
          facts={
            <RecordFacts facts={resolveFacts({ registry: gitlabIssueFields, entity: issue })} />
          }
          externalRef={{ url: issue.webUrl, label: 'issue' }}
          frame={frame}
        />
      }
    >
      <RecordSections
        sections={[
          {
            key: 'description',
            kind: 'description',
            label: 'Description',
            isCollapsible: false,
            defaultOpen: true,
            content: <DescriptionSection text={description} onSave={save} />,
          },
          conversation.section,
        ]}
      />
    </PaneShell>
  );
};
