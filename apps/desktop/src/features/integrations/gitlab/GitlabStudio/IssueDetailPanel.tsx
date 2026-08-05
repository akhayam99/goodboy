import { useState } from 'react';
import { EmptyState } from '@goodboy/ui';
import { FileText, MessageSquare } from 'lucide-react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import type { SegmentedTabOption } from '@goodboy/ui';
import {
  HeaderBand,
  StudioDetailLayout,
  StudioDetailTabs,
} from '../../../../shared/components/StudioDetail';
import { DescriptionSection } from '../../../../shared/components/DescriptionSection';
import { gitlabIssueFields, resolveDetailFields } from '../../../../shared/detail-fields';
import { IssueStateBadge } from '../../../../shared/components/IssueStateBadge';
import { ExternalRefActions } from '../../../../shared/components/ExternalRefActions';
import { LaunchSessionPanel } from '../../../integrations/components/LaunchSessionPanel';
import { goalFromIssue } from '../goal-from-issue';
import { issueIdentifier, type GitlabIssue } from '../client';
import { gitlabBranchSlug } from './useGitlabIssues';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { useGitlabIssueDescription } from '../useGitlabIssueDescription';
import { useGitlabIssueNotes } from '../useGitlabIssueNotes';
import { IssueConversation } from '../IssueConversation';

type Props = {
  readonly issue: GitlabIssue | null;
  readonly sessionId: SessionId | null;
  readonly workspaceId: WorkspaceId;
  readonly onClose: () => void;
};

type IssueSection = 'overview' | 'conversation';

const SECTION_OPTIONS: ReadonlyArray<SegmentedTabOption<IssueSection>> = [
  { value: 'overview', label: 'Overview', icon: FileText },
  { value: 'conversation', label: 'Conversation', icon: MessageSquare },
];

export const IssueDetailPanel = ({ issue, sessionId, workspaceId, onClose }: Props) => {
  const [section, setSection] = useState<IssueSection>('overview');
  const { description, save } = useGitlabIssueDescription({ issue, workspaceId });
  const notes = useGitlabIssueNotes({ issue, workspaceId });

  if (!issue) {
    return (
      <div className="flex h-full items-center justify-center px-8">
        <EmptyState
          bordered
          tone={CONCEPT_TONE.gitlab}
          icon={CONCEPT_ICONS.gitlab}
          title="No issue selected"
          description="Pick an issue to see its details and launch a session."
          size="lg"
          headingLevel={2}
        />
      </div>
    );
  }

  const launch = (
    <LaunchSessionPanel
      key={issue.id}
      workspaceId={workspaceId}
      linkedSessionId={sessionId}
      goalSeed={goalFromIssue(issue)}
      branchSlugSeed={gitlabBranchSlug(issue)}
      externalTask={{
        provider: 'gitlab',
        externalId: String(issue.id),
        identifier: issueIdentifier(issue),
        url: issue.webUrl,
        title: issue.title,
      }}
      onClose={onClose}
    />
  );

  return (
    <StudioDetailLayout
      header={
        <HeaderBand
          meta={
            <>
              <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                {issueIdentifier(issue)}
              </span>
              <IssueStateBadge>{issue.state}</IssueStateBadge>
            </>
          }
          title={issue.title}
          actions={<ExternalRefActions url={issue.webUrl} label="issue" hostLabel="GitLab" />}
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
      dock={launch}
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
