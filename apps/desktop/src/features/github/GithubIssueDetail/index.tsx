import { useMemo, type ReactNode } from 'react';
import { Markdown } from '@goodboy/ui';
import type { GithubIssue } from '@goodboy/types';
import {
  DetailSection,
  HeaderBand,
  StudioDetailLayout,
} from '../../../shared/components/StudioDetail';
import { githubIssueFields, resolveDetailFields } from '../../../shared/detail-fields';
import { IssueStateBadge } from '../../../shared/components/IssueStateBadge';
import { ExternalRefActions } from '../../../shared/components/ExternalRefActions';

type Fit = 'fill' | 'bleed' | 'flow';

type Props = {
  readonly issue: GithubIssue;
  readonly headerActions?: ReactNode;
  readonly fit?: Fit;
};

export const GithubIssueDetail = ({ issue, headerActions, fit = 'fill' }: Props) => {
  const properties = useMemo(
    () => resolveDetailFields({ registry: githubIssueFields, entity: issue }),
    [issue],
  );
  return (
    <StudioDetailLayout
      fit={fit}
      header={
        <HeaderBand
          meta={
            <>
              <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                #{issue.number}
              </span>
              <IssueStateBadge>{issue.state.toLowerCase()}</IssueStateBadge>
            </>
          }
          title={issue.title}
          actions={
            <>
              {headerActions}
              <ExternalRefActions url={issue.url} label="issue" hostLabel="GitHub" />
            </>
          }
        />
      }
      properties={properties}
    >
      <DetailSection label="description" variant="frameless">
        {issue.body.trim() !== '' ? (
          <Markdown text={issue.body} className="text-sm leading-relaxed" />
        ) : (
          <p className="text-sm italic text-muted-foreground/60">No description.</p>
        )}
      </DetailSection>
    </StudioDetailLayout>
  );
};
