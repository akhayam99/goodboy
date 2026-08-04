import { useMemo, type ReactNode } from 'react';
import type { GithubIssue } from '@goodboy/types';
import { HeaderBand, StudioDetailLayout } from '../../../shared/components/StudioDetail';
import { githubIssueFields, resolveDetailFields } from '../../../shared/detail-fields';
import { IssueStateBadge } from '../../../shared/components/IssueStateBadge';
import { ExternalRefActions } from '../../../shared/components/ExternalRefActions';
import { DescriptionSection } from '../../../shared/components/DescriptionSection';
import {
  useGithubIssueDescription,
  type GithubIssueEditContext,
} from '../useGithubIssueDescription';

type Fit = 'fill' | 'bleed' | 'flow';

type Props = {
  readonly issue: GithubIssue;
  readonly headerActions?: ReactNode;
  readonly dock?: ReactNode;
  readonly fit?: Fit;
  readonly editContext?: GithubIssueEditContext | null;
};

export const GithubIssueDetail = ({
  issue,
  headerActions,
  dock,
  fit = 'fill',
  editContext,
}: Props) => {
  const { description, save } = useGithubIssueDescription({ issue, editContext });
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
      dock={dock}
      properties={properties}
    >
      <DescriptionSection text={description} onSave={save} />
    </StudioDetailLayout>
  );
};
