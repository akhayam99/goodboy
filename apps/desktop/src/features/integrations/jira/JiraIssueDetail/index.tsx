import { RecordDetailHeader, StudioDetailLayout } from '../../../../shared/components/StudioDetail';
import { useState, type ReactNode } from 'react';
import { FileText, MessageSquare } from 'lucide-react';
import type { ProjectId, WorkspaceId } from '@goodboy/types';
import type { SegmentedTabOption } from '@goodboy/ui';
import { StudioDetailTabs } from '@goodboy/ui';
import { DescriptionSection } from '../../../../shared/components/DescriptionSection';
import { jiraIssueFields, resolveDetailFields } from '../../../../shared/detail-fields';
import { StateBadge } from '@goodboy/ui';
import type { JiraIssue } from '../client';
import { statusCategoryTone } from '../statusCategoryTone';
import { useJiraIssueActions } from '../useJiraIssueActions';
import { useJiraIssueComments } from '../useJiraIssueComments';
import { AssigneePicker } from '../AssigneePicker';
import { TransitionMenu } from '../TransitionMenu';
import { IssueConversation } from '../IssueConversation';

type Fit = 'fill' | 'bleed' | 'flow';
type IssueSection = 'overview' | 'conversation';

type Props = {
  readonly issue: JiraIssue;
  readonly workspaceId: WorkspaceId;
  readonly projectId?: ProjectId;
  readonly headerActions?: ReactNode;
  readonly dock?: ReactNode;
  readonly fit?: Fit;
  readonly onIssueWritten?: (() => void) | null;
};

const SECTION_OPTIONS: ReadonlyArray<SegmentedTabOption<IssueSection>> = [
  { value: 'overview', label: 'Overview', icon: FileText },
  { value: 'conversation', label: 'Conversation', icon: MessageSquare },
];

export const JiraIssueDetail = ({
  issue,
  workspaceId,
  projectId,
  headerActions,
  dock,
  fit = 'fill',
  onIssueWritten,
}: Props) => {
  const [section, setSection] = useState<IssueSection>('overview');
  const actions = useJiraIssueActions({ issue, workspaceId, projectId, onWritten: onIssueWritten });
  const live = actions.issue;
  const conversation = useJiraIssueComments({ issue: live, workspaceId, projectId });

  return (
    <StudioDetailLayout
      fit={fit}
      dock={dock}
      header={
        <RecordDetailHeader
          provider="jira"
          identifier={live.key}
          title={live.summary}
          badge={
            <StateBadge tone={statusCategoryTone({ statusCategory: live.statusCategory })}>
              {live.status}
            </StateBadge>
          }
          actions={
            <>
              {actions.assign != null && (
                <AssigneePicker
                  issueKey={live.key}
                  workspaceId={workspaceId}
                  assignee={live.assignee}
                  onAssign={actions.assign}
                />
              )}
              {actions.transition != null && (
                <TransitionMenu
                  issueKey={live.key}
                  workspaceId={workspaceId}
                  onTransition={actions.transition}
                />
              )}
              {headerActions}
            </>
          }
          externalRef={{ url: live.url, label: 'issue' }}
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
      properties={resolveDetailFields({ registry: jiraIssueFields, entity: live })}
    >
      {section === 'overview' ? (
        <DescriptionSection text={live.description} onSave={actions.saveDescription} />
      ) : (
        <IssueConversation
          comments={conversation.comments}
          isLoading={conversation.isLoading}
          error={conversation.error}
          onRetry={conversation.reload}
          onPost={conversation.post}
        />
      )}
    </StudioDetailLayout>
  );
};
