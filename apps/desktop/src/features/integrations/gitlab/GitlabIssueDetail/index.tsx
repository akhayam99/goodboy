import { RecordHeader } from '../../../../shared/components/StudioDetail/RecordHeader';
import type { RecordFrame } from '../../../../shared/components/StudioDetail/RecordActions/types';
import { DetailProperties } from '../../../../shared/components/StudioDetail/DetailProperties';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { useState } from 'react';
import { FileText, MessageSquare } from 'lucide-react';
import type { ProjectId, WorkspaceId } from '@goodboy/types';
import type { SegmentedTabOption } from '@goodboy/ui';
import { StudioDetailTabs } from '@goodboy/ui';
import { DescriptionSection } from '../../../../shared/components/DescriptionSection';
import { gitlabIssueFields, resolveDetailFields } from '../../../../shared/detail-fields';
import { StateBadge } from '@goodboy/ui';
import { stateWord } from '../../../inbox/stateWord';
import { issueIdentifier, type GitlabIssue } from '../client';
import { useGitlabIssueDescription } from '../useGitlabIssueDescription';
import { useGitlabIssueNotes } from '../useGitlabIssueNotes';
import { IssueConversation } from '../IssueConversation';

type IssueSection = 'overview' | 'conversation';

type Props = {
  readonly issue: GitlabIssue;
  readonly workspaceId: WorkspaceId;
  readonly projectId?: ProjectId;
  readonly frame?: RecordFrame | null;
};

const SECTION_OPTIONS: ReadonlyArray<SegmentedTabOption<IssueSection>> = [
  { value: 'overview', label: 'Overview', icon: FileText },
  { value: 'conversation', label: 'Conversation', icon: MessageSquare },
];

export const GitlabIssueDetail = ({ issue, workspaceId, projectId, frame = null }: Props) => {
  const [section, setSection] = useState<IssueSection>('overview');
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
          externalRef={{ url: issue.webUrl, label: 'issue' }}
          frame={frame}
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
