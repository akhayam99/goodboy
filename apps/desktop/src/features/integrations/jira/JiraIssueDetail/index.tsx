import { useState, type ReactNode } from 'react';
import { FileText, MessageSquare } from 'lucide-react';
import type { WorkspaceId } from '@goodboy/types';
import type { SegmentedTabOption } from '@goodboy/ui';
import {
  HeaderBand,
  StudioDetailLayout,
  StudioDetailTabs,
} from '../../../../shared/components/StudioDetail';
import { DescriptionSection } from '../../../../shared/components/DescriptionSection';
import { jiraIssueFields, resolveDetailFields } from '../../../../shared/detail-fields';
import { IssueStateBadge } from '../../../../shared/components/IssueStateBadge';
import { ExternalRefActions } from '../../../../shared/components/ExternalRefActions';
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
  headerActions,
  dock,
  fit = 'fill',
  onIssueWritten,
}: Props) => {
  const [section, setSection] = useState<IssueSection>('overview');
  const actions = useJiraIssueActions({ issue, workspaceId, onWritten: onIssueWritten });
  const live = actions.issue;
  const conversation = useJiraIssueComments({ issue: live, workspaceId });

  return (
    <StudioDetailLayout
      fit={fit}
      dock={dock}
      header={
        <HeaderBand
          meta={
            <>
              <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                {live.key}
              </span>
              <IssueStateBadge tone={statusCategoryTone({ statusCategory: live.statusCategory })}>
                {live.status}
              </IssueStateBadge>
            </>
          }
          title={live.summary}
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
              <ExternalRefActions url={live.url} label="issue" hostLabel="Jira" />
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
