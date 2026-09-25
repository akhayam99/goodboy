import { PaneShell } from '../../../../shared/components/PaneShell';
import { RecordHeader } from '../../../../shared/components/StudioDetail/RecordHeader';
import { RecordFacts } from '../../../../shared/components/StudioDetail/RecordFacts';
import { RecordSections } from '../../../../shared/components/StudioDetail/RecordSections';
import type { RecordFrame } from '../../../../shared/components/StudioDetail/RecordActions/types';
import type { ProjectId, WorkspaceId } from '@goodboy/types';
import { StateBadge } from '@goodboy/ui';
import { DescriptionSection } from '../../../../shared/components/DescriptionSection';
import { linearIssueFields, resolveFacts } from '../../../../shared/detail-fields';
import type { LinearIssue } from '../client';
import { LinearIssueComments } from '../LinearIssueComments';
import { useLinearIssueComments } from '../useLinearIssueComments';
import { useLinearIssueDescription } from '../useLinearIssueDescription';

type Props = {
  readonly issue: LinearIssue;
  readonly workspaceId: WorkspaceId;
  readonly projectId?: ProjectId;
  readonly frame?: RecordFrame | null;
};

export const LinearIssueDetail = ({ issue, workspaceId, projectId, frame = null }: Props) => {
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
          facts={
            <RecordFacts facts={resolveFacts({ registry: linearIssueFields, entity: issue })} />
          }
          externalRef={{ url: issue.url, label: 'issue' }}
          frame={frame}
        />
      }
    >
      <RecordSections
        sections={[
          {
            key: 'description',
            kind: 'description',
            label: 'Description',
            isCollapsible: false,
            defaultOpen: true,
            content: <DescriptionSection text={description} onSave={save} />,
          },
          {
            key: 'conversation',
            kind: 'conversation',
            label: 'Conversation',
            count: comments.length,
            isCollapsible: false,
            defaultOpen: true,
            content: (
              <LinearIssueComments
                comments={comments}
                isLoading={isLoading}
                error={error}
                onPost={post}
              />
            ),
          },
        ]}
      />
    </PaneShell>
  );
};
