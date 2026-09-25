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
import { jiraIssueFields, resolveDetailFields } from '../../../../shared/detail-fields';
import { StateBadge } from '@goodboy/ui';
import type { JiraIssue } from '../client';
import { statusCategoryTone } from '../statusCategoryTone';
import { useJiraIssueActions } from '../useJiraIssueActions';
import { useJiraIssueComments } from '../useJiraIssueComments';
import { AssigneePicker } from '../AssigneePicker';
import { TransitionMenu } from '../TransitionMenu';
import { IssueConversation } from '../IssueConversation';

type IssueSection = 'overview' | 'conversation';

type Props = {
  readonly issue: JiraIssue;
  readonly workspaceId: WorkspaceId;
  readonly projectId?: ProjectId;
  readonly frame?: RecordFrame | null;
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
  frame = null,
  onIssueWritten,
}: Props) => {
  const [section, setSection] = useState<IssueSection>('overview');
  const actions = useJiraIssueActions({ issue, workspaceId, projectId, onWritten: onIssueWritten });
  const live = actions.issue;
  const conversation = useJiraIssueComments({ issue: live, workspaceId, projectId });

  return (
    <PaneShell
      scroll="body"
      header={
        <RecordHeader
          provider="jira"
          identifier={live.key}
          title={live.summary}
          state={
            actions.transition != null ? (
              <TransitionMenu
                issueKey={live.key}
                workspaceId={workspaceId}
                onTransition={actions.transition}
                state={{
                  label: live.status,
                  tone: statusCategoryTone({ statusCategory: live.statusCategory }),
                }}
              />
            ) : (
              <StateBadge tone={statusCategoryTone({ statusCategory: live.statusCategory })}>
                {live.status}
              </StateBadge>
            )
          }
          facts={
            actions.assign != null ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <AssigneePicker
                  issueKey={live.key}
                  workspaceId={workspaceId}
                  assignee={live.assignee}
                  onAssign={actions.assign}
                />
              </div>
            ) : undefined
          }
          externalRef={{ url: live.url, label: 'issue' }}
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
        entries={resolveDetailFields({ registry: jiraIssueFields, entity: live })}
      />
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
    </PaneShell>
  );
};
