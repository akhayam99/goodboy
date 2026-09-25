import { RecordHeader } from '../../../../shared/components/StudioDetail/RecordHeader';
import type { RecordFrame } from '../../../../shared/components/StudioDetail/RecordActions/types';
import { DetailProperties } from '../../../../shared/components/StudioDetail/DetailProperties';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { useState } from 'react';
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
  readonly frame?: RecordFrame | null;
};

export const LinearIssueDetail = ({ issue, workspaceId, projectId, frame = null }: Props) => {
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
        <RecordHeader
          provider="linear"
          identifier={issue.identifier}
          title={issue.title}
          state={<StateBadge>{issue.state.name}</StateBadge>}
          externalRef={{ url: issue.url, label: 'issue' }}
          frame={frame}
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
