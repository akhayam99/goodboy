import { RecordDetailHeader, StudioDetailLayout } from '../../../../shared/components/StudioDetail';
import { useState, type ReactNode } from 'react';
import { FileText, MessageSquare } from 'lucide-react';
import type { ProjectId, WorkspaceId } from '@goodboy/types';
import type { SegmentedTabOption } from '@goodboy/ui';
import { StudioDetailTabs } from '@goodboy/ui';
import { DescriptionSection } from '../../../../shared/components/DescriptionSection';
import { gitlabIssueFields, resolveDetailFields } from '../../../../shared/detail-fields';
import { StateBadge } from '@goodboy/ui';
import { issueIdentifier, type GitlabIssue } from '../client';
import { useGitlabIssueDescription } from '../useGitlabIssueDescription';
import { useGitlabIssueNotes } from '../useGitlabIssueNotes';
import { IssueConversation } from '../IssueConversation';

type Fit = 'fill' | 'bleed' | 'flow';
type IssueSection = 'overview' | 'conversation';

type Props = {
  readonly issue: GitlabIssue;
  readonly workspaceId: WorkspaceId;
  readonly projectId?: ProjectId;
  readonly headerActions?: ReactNode;
  readonly dock?: ReactNode;
  readonly fit?: Fit;
};

const SECTION_OPTIONS: ReadonlyArray<SegmentedTabOption<IssueSection>> = [
  { value: 'overview', label: 'Overview', icon: FileText },
  { value: 'conversation', label: 'Conversation', icon: MessageSquare },
];

export const GitlabIssueDetail = ({
  issue,
  workspaceId,
  projectId,
  headerActions,
  dock,
  fit = 'fill',
}: Props) => {
  const [section, setSection] = useState<IssueSection>('overview');
  const { description, save } = useGitlabIssueDescription({ issue, workspaceId, projectId });
  const notes = useGitlabIssueNotes({ issue, workspaceId, projectId });

  return (
    <StudioDetailLayout
      fit={fit}
      header={
        <RecordDetailHeader
          provider="gitlab"
          identifier={issueIdentifier(issue)}
          title={issue.title}
          badge={<StateBadge>{issue.state}</StateBadge>}
          actions={headerActions}
          externalRef={{ url: issue.webUrl, label: 'issue' }}
        />
      }
      tabs={
        <StudioDetailTabs
          ariaLabel="Issue sections"
          options={SECTION_OPTIONS}
          value={section}
          onChange={setSection}
        />
      }
      properties={resolveDetailFields({ registry: gitlabIssueFields, entity: issue })}
      dock={dock}
    >
      {section === 'overview' ? (
        <DescriptionSection text={description} onSave={save} />
      ) : (
        <IssueConversation
          notes={notes.notes}
          isLoading={notes.isLoading}
          error={notes.error}
          onRetry={notes.reload}
          onPost={notes.post}
        />
      )}
    </StudioDetailLayout>
  );
};
