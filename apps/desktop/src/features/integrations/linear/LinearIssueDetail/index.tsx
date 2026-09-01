import { StudioDetailLayout } from '../../../../shared/components/StudioDetail';
import { useState, type ReactNode } from 'react';
import { FileText, MessageSquare } from 'lucide-react';
import type { ProjectId, WorkspaceId } from '@goodboy/types';
import { HeaderBand, StudioDetailTabs } from '@goodboy/ui';
import { DescriptionSection } from '../../../../shared/components/DescriptionSection';
import { linearIssueFields, resolveDetailFields } from '../../../../shared/detail-fields';
import { StateBadge } from '@goodboy/ui';
import { ExternalRefActions } from '../../../../shared/components/ExternalRefActions';
import type { LinearIssue } from '../client';
import { LinearIssueComments } from '../LinearIssueComments';
import { useLinearIssueComments } from '../useLinearIssueComments';
import { useLinearIssueDescription } from '../useLinearIssueDescription';

type IssueSection = 'overview' | 'conversation';
type Fit = 'fill' | 'bleed' | 'flow';

type Props = {
  readonly issue: LinearIssue;
  readonly workspaceId: WorkspaceId;
  readonly projectId?: ProjectId;
  readonly dock?: ReactNode;
  readonly headerActions?: ReactNode;
  readonly fit?: Fit;
};

export const LinearIssueDetail = ({
  issue,
  workspaceId,
  projectId,
  dock,
  headerActions,
  fit = 'fill',
}: Props) => {
  const [section, setSection] = useState<IssueSection>('overview');
  const { comments, isLoading, error, post } = useLinearIssueComments({
    workspaceId,
    issueId: issue.id,
    projectId,
  });
  const { description, save } = useLinearIssueDescription({ issue, workspaceId, projectId });

  return (
    <StudioDetailLayout
      fit={fit}
      header={
        <HeaderBand
          title={issue.title}
          meta={
            <>
              <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                {issue.identifier}
              </span>
              <StateBadge>{issue.state.name}</StateBadge>
            </>
          }
          actions={
            <>
              {headerActions}
              <ExternalRefActions url={issue.url} label="issue" hostLabel="Linear" />
            </>
          }
        />
      }
      tabs={
        <StudioDetailTabs
          ariaLabel="Issue sections"
          value={section}
          onChange={setSection}
          options={[
            { value: 'overview', label: 'Overview', icon: FileText },
            {
              value: 'conversation',
              label: 'Conversation',
              icon: MessageSquare,
              ...(comments.length > 0 && { badge: String(comments.length) }),
            },
          ]}
        />
      }
      dock={dock}
      properties={resolveDetailFields({ registry: linearIssueFields, entity: issue })}
    >
      {section === 'overview' ? (
        <DescriptionSection text={description} onSave={save} />
      ) : (
        <LinearIssueComments
          comments={comments}
          isLoading={isLoading}
          error={error}
          onPost={post}
        />
      )}
    </StudioDetailLayout>
  );
};
