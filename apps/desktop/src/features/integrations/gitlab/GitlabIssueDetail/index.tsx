import { RecordDetailHeader } from '../../../../shared/components/StudioDetail';
import { DetailProperties } from '../../../../shared/components/StudioDetail/DetailProperties';
import { PaneShell } from '../../../../shared/components/PaneShell';
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

type IssueSection = 'overview' | 'conversation';

type Props = {
  readonly issue: GitlabIssue;
  readonly workspaceId: WorkspaceId;
  readonly projectId?: ProjectId;
  readonly headerActions?: ReactNode;
  readonly dock?: ReactNode;
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
}: Props) => {
  const [section, setSection] = useState<IssueSection>('overview');
  const { description, save } = useGitlabIssueDescription({ issue, workspaceId, projectId });
  const notes = useGitlabIssueNotes({ issue, workspaceId, projectId });

  return (
    <PaneShell
      scroll="body"
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
      dock={dock}
    >
      <DetailProperties
        entries={resolveDetailFields({ registry: gitlabIssueFields, entity: issue })}
      />
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
    </PaneShell>
  );
};
