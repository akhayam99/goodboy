import { StudioDetailLayout } from '../../../../shared/components/StudioDetail';
import { useState, type ReactNode } from 'react';
import { FileText, MessageSquare } from 'lucide-react';
import type { WorkspaceId } from '@goodboy/types';
import type { SegmentedTabOption } from '@goodboy/ui';
import { HeaderBand, StudioDetailTabs } from '@goodboy/ui';
import { DescriptionSection } from '../../../../shared/components/DescriptionSection';
import { gitlabIssueFields, resolveDetailFields } from '../../../../shared/detail-fields';
import { StateBadge } from '@goodboy/ui';
import { ExternalRefActions } from '../../../../shared/components/ExternalRefActions';
import { issueIdentifier, type GitlabIssue } from '../client';
import { useGitlabIssueDescription } from '../useGitlabIssueDescription';
import { useGitlabIssueNotes } from '../useGitlabIssueNotes';
import { IssueConversation } from '../IssueConversation';

type Fit = 'fill' | 'bleed' | 'flow';
type IssueSection = 'overview' | 'conversation';

type Props = {
  readonly issue: GitlabIssue;
  readonly workspaceId: WorkspaceId;
  readonly headerActions?: ReactNode;
  readonly fit?: Fit;
};

const SECTION_OPTIONS: ReadonlyArray<SegmentedTabOption<IssueSection>> = [
  { value: 'overview', label: 'Overview', icon: FileText },
  { value: 'conversation', label: 'Conversation', icon: MessageSquare },
];

export const GitlabIssueDetail = ({ issue, workspaceId, headerActions, fit = 'fill' }: Props) => {
  const [section, setSection] = useState<IssueSection>('overview');
  const { description, save } = useGitlabIssueDescription({ issue, workspaceId });
  const notes = useGitlabIssueNotes({ issue, workspaceId });

  return (
    <StudioDetailLayout
      fit={fit}
      header={
        <HeaderBand
          meta={
            <>
              <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                {issueIdentifier(issue)}
              </span>
              <StateBadge>{issue.state}</StateBadge>
            </>
          }
          title={issue.title}
          actions={
            <>
              {headerActions}
              <ExternalRefActions url={issue.webUrl} label="issue" hostLabel="GitLab" />
            </>
          }
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
