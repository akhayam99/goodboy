import { PaneShell } from '../../../../shared/components/PaneShell';
import { RecordHeader } from '../../../../shared/components/StudioDetail/RecordHeader';
import { RecordFacts } from '../../../../shared/components/StudioDetail/RecordFacts';
import { RecordSections } from '../../../../shared/components/StudioDetail/RecordSections';
import type { RecordFrame } from '../../../../shared/components/StudioDetail/RecordActions/types';
import type { ProjectId, WorkspaceId } from '@goodboy/types';
import { StateBadge } from '@goodboy/ui';
import { DescriptionSection } from '../../../../shared/components/DescriptionSection';
import { gitlabIssueFields, resolveFacts } from '../../../../shared/detail-fields';
import { stateWord } from '../../../inbox/stateWord';
import { issueIdentifier, type GitlabIssue } from '../client';
import { useGitlabIssueDescription } from '../useGitlabIssueDescription';
import { useGitlabIssueNotes } from '../useGitlabIssueNotes';
import { IssueConversation } from '../IssueConversation';

type Props = {
  readonly issue: GitlabIssue;
  readonly workspaceId: WorkspaceId;
  readonly projectId?: ProjectId;
  readonly frame?: RecordFrame | null;
};

export const GitlabIssueDetail = ({ issue, workspaceId, projectId, frame = null }: Props) => {
  const { description, save } = useGitlabIssueDescription({ issue, workspaceId, projectId });
  const notes = useGitlabIssueNotes({ issue, workspaceId, projectId });

  return (
    <PaneShell
      scroll="body"
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
          {
            key: 'conversation',
            kind: 'conversation',
            label: 'Conversation',
            count: notes.notes.length,
            isCollapsible: false,
            defaultOpen: true,
            content: (
              <IssueConversation
                notes={notes.notes}
                isLoading={notes.isLoading}
                error={notes.error}
                onRetry={notes.reload}
                onPost={notes.post}
              />
            ),
          },
        ]}
      />
    </PaneShell>
  );
};
