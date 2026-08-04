import type { ReactNode } from 'react';
import { HeaderBand, StudioDetailLayout } from '../../../../shared/components/StudioDetail';
import { DescriptionSection } from '../../../../shared/components/DescriptionSection';
import { gitlabIssueFields, resolveDetailFields } from '../../../../shared/detail-fields';
import { IssueStateBadge } from '../../../../shared/components/IssueStateBadge';
import { ExternalRefActions } from '../../../../shared/components/ExternalRefActions';
import { issueIdentifier, type GitlabIssue } from '../client';

type Fit = 'fill' | 'bleed' | 'flow';

type Props = {
  readonly issue: GitlabIssue;
  readonly headerActions?: ReactNode;
  readonly fit?: Fit;
};

export const GitlabIssueDetail = ({ issue, headerActions, fit = 'fill' }: Props) => {
  return (
    <StudioDetailLayout
      fit={fit}
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
          actions={
            <>
              {headerActions}
              <ExternalRefActions url={issue.webUrl} label="issue" hostLabel="GitLab" />
            </>
          }
        />
      }
      properties={resolveDetailFields({ registry: gitlabIssueFields, entity: issue })}
    >
      <DescriptionSection text={issue.description ?? ''} />
    </StudioDetailLayout>
  );
};
