import { RecordDetailHeader, StudioDetailLayout } from '../../../shared/components/StudioDetail';
import { useMemo, useState, type ReactNode } from 'react';
import { FileText, MessageSquare } from 'lucide-react';
import type { GithubIssue } from '@goodboy/types';
import type { SegmentedTabOption } from '@goodboy/ui';
import { StudioDetailTabs } from '@goodboy/ui';
import { githubIssueFields, resolveDetailFields } from '../../../shared/detail-fields';
import { StateBadge } from '@goodboy/ui';
import { DescriptionSection } from '../../../shared/components/DescriptionSection';
import { GithubIssueComments } from '../GithubIssueComments';
import { useGithubIssueComments } from '../useGithubIssueComments';
import {
  useGithubIssueDescription,
  type GithubIssueEditContext,
} from '../useGithubIssueDescription';

type Fit = 'fill' | 'bleed' | 'flow';
type IssueSection = 'overview' | 'conversation';

type Props = {
  readonly issue: GithubIssue;
  readonly headerActions?: ReactNode;
  readonly dock?: ReactNode;
  readonly fit?: Fit;
  readonly editContext?: GithubIssueEditContext | null;
  readonly eyebrow?: ReactNode;
};

export const GithubIssueDetail = ({
  issue,
  headerActions,
  dock,
  fit = 'fill',
  editContext,
  eyebrow,
}: Props) => {
  const [section, setSection] = useState<IssueSection>('overview');
  const { description, save } = useGithubIssueDescription({ issue, editContext });
  const { comments, isLoading, error, post } = useGithubIssueComments({
    workspaceId: editContext?.workspaceId ?? null,
    rootPath: editContext?.rootPath ?? null,
    issueNumber: issue.number,
  });
  const properties = useMemo(
    () => resolveDetailFields({ registry: githubIssueFields, entity: issue }),
    [issue],
  );

  const tabOptions: ReadonlyArray<SegmentedTabOption<IssueSection>> = [
    { value: 'overview', label: 'Overview', icon: FileText },
    ...(editContext != null
      ? [
          {
            value: 'conversation' as const,
            label: 'Conversation',
            icon: MessageSquare,
            ...(comments.length > 0 && { badge: String(comments.length) }),
          },
        ]
      : []),
  ];

  return (
    <StudioDetailLayout
      fit={fit}
      eyebrow={eyebrow}
      header={
        <RecordDetailHeader
          provider="github"
          identifier={`#${issue.number}`}
          title={issue.title}
          badge={<StateBadge>{issue.state.toLowerCase()}</StateBadge>}
          actions={headerActions}
          externalRef={{ url: issue.url, label: 'issue' }}
        />
      }
      tabs={
        <StudioDetailTabs
          ariaLabel="Issue sections"
          value={section}
          onChange={setSection}
          options={tabOptions}
        />
      }
      dock={dock}
      properties={properties}
    >
      {section === 'overview' ? (
        <DescriptionSection text={description} onSave={save} />
      ) : (
        <GithubIssueComments
          comments={comments}
          isLoading={isLoading}
          error={error}
          onPost={post}
        />
      )}
    </StudioDetailLayout>
  );
};
