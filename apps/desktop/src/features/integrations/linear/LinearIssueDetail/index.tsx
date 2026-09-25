import { RecordDetailHeader } from '../../../../shared/components/StudioDetail';
import { DetailProperties } from '../../../../shared/components/StudioDetail/DetailProperties';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { useState, type ReactNode } from 'react';
import { FileText, MessageSquare } from 'lucide-react';
import type { ProjectId, WorkspaceId } from '@goodboy/types';
import { StudioDetailTabs } from '@goodboy/ui';
import { DescriptionSection } from '../../../../shared/components/DescriptionSection';
import { linearIssueFields, resolveDetailFields } from '../../../../shared/detail-fields';
import { StateBadge } from '@goodboy/ui';
import type { LinearIssue } from '../client';
import { LinearIssueComments } from '../LinearIssueComments';
import { useLinearIssueComments } from '../useLinearIssueComments';
import { useLinearIssueDescription } from '../useLinearIssueDescription';

type IssueSection = 'overview' | 'conversation';

type Props = {
  readonly issue: LinearIssue;
  readonly workspaceId: WorkspaceId;
  readonly projectId?: ProjectId;
  readonly dock?: ReactNode;
  readonly headerActions?: ReactNode;
};

export const LinearIssueDetail = ({
  issue,
  workspaceId,
  projectId,
  dock,
  headerActions,
}: Props) => {
  const [section, setSection] = useState<IssueSection>('overview');
  const { comments, isLoading, error, post } = useLinearIssueComments({
    workspaceId,
    issueId: issue.id,
    projectId,
  });
  const { description, save } = useLinearIssueDescription({ issue, workspaceId, projectId });

  return (
    <PaneShell
      scroll="body"
      header={
        <RecordDetailHeader
          provider="linear"
          identifier={issue.identifier}
          title={issue.title}
          badge={<StateBadge>{issue.state.name}</StateBadge>}
          actions={headerActions}
          externalRef={{ url: issue.url, label: 'issue' }}
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
    >
      <DetailProperties
        entries={resolveDetailFields({ registry: linearIssueFields, entity: issue })}
      />
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
    </PaneShell>
  );
};
