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
import { useJiraIssueComments } from '../useJiraIssueComments';
import { IssueConversation } from '../IssueConversation';

type Fit = 'fill' | 'bleed' | 'flow';
type IssueSection = 'overview' | 'conversation';

type Props = {
  readonly issue: JiraIssue;
  readonly workspaceId: WorkspaceId;
  readonly headerActions?: ReactNode;
  readonly dock?: ReactNode;
  readonly fit?: Fit;
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
}: Props) => {
  const [section, setSection] = useState<IssueSection>('overview');
  const conversation = useJiraIssueComments({ issue, workspaceId });

  return (
    <StudioDetailLayout
      fit={fit}
      dock={dock}
      header={
        <HeaderBand
          meta={
            <>
              <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                {issue.key}
              </span>
              <IssueStateBadge tone={statusCategoryTone({ statusCategory: issue.statusCategory })}>
                {issue.status}
              </IssueStateBadge>
            </>
          }
          title={issue.summary}
          actions={
            <>
              {headerActions}
              <ExternalRefActions url={issue.url} label="issue" hostLabel="Jira" />
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
      properties={resolveDetailFields({ registry: jiraIssueFields, entity: issue })}
    >
      {section === 'overview' ? (
        <DescriptionSection text={issue.description} />
      ) : (
        <IssueConversation
          comments={conversation.comments}
          isLoading={conversation.isLoading}
          error={conversation.error}
          onRetry={conversation.reload}
        />
      )}
    </StudioDetailLayout>
  );
};
