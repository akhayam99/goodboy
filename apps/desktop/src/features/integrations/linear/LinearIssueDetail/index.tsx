import { useState, type ReactNode } from 'react';
import { FileText, MessageSquare } from 'lucide-react';
import type { WorkspaceId } from '@goodboy/types';
import {
  HeaderBand,
  StudioDetailLayout,
  StudioDetailTabs,
} from '../../../../shared/components/StudioDetail';
import { DescriptionSection } from '../../../../shared/components/DescriptionSection';
import { linearIssueFields, resolveDetailFields } from '../../../../shared/detail-fields';
import { IssueStateBadge } from '../../../../shared/components/IssueStateBadge';
import { ExternalRefActions } from '../../../../shared/components/ExternalRefActions';
import type { LinearIssue } from '../client';
import { LinearIssueComments } from '../LinearIssueComments';
import { useLinearIssueComments } from '../useLinearIssueComments';

type IssueSection = 'overview' | 'conversation';
type Fit = 'fill' | 'bleed' | 'flow';

type Props = {
  readonly issue: LinearIssue;
  readonly workspaceId: WorkspaceId;
  readonly dock?: ReactNode;
  readonly headerActions?: ReactNode;
  readonly fit?: Fit;
};

export const LinearIssueDetail = ({
  issue,
  workspaceId,
  dock,
  headerActions,
  fit = 'fill',
}: Props) => {
  const [section, setSection] = useState<IssueSection>('overview');
  const { comments, isLoading, error } = useLinearIssueComments({
    workspaceId,
    issueId: issue.id,
  });

  return (
    <StudioDetailLayout
      fit={fit}
      header={
        <HeaderBand
          meta={
            <>
              <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                {issue.identifier}
              </span>
              <IssueStateBadge>{issue.state.name}</IssueStateBadge>
            </>
          }
          title={issue.title}
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
        <DescriptionSection text={issue.description ?? ''} />
      ) : (
        <LinearIssueComments comments={comments} isLoading={isLoading} error={error} />
      )}
    </StudioDetailLayout>
  );
};
