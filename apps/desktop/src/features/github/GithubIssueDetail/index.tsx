import { RecordHeader } from '../../../shared/components/StudioDetail/RecordHeader';
import type { RecordFrame } from '../../../shared/components/StudioDetail/RecordActions/types';
import { DetailProperties } from '../../../shared/components/StudioDetail/DetailProperties';
import { PaneShell } from '../../../shared/components/PaneShell';
import { useMemo, useState } from 'react';
import { FileText, MessageSquare } from 'lucide-react';
import type { GithubIssue } from '@goodboy/types';
import type { SegmentedTabOption } from '@goodboy/ui';
import { StudioDetailTabs } from '@goodboy/ui';
import { githubIssueFields, resolveDetailFields } from '../../../shared/detail-fields';
import { StateBadge } from '@goodboy/ui';
import { stateWord } from '../../inbox/stateWord';
import { DescriptionSection } from '../../../shared/components/DescriptionSection';
import { GithubIssueComments } from '../GithubIssueComments';
import { useGithubIssueComments } from '../useGithubIssueComments';
import {
  useGithubIssueDescription,
  type GithubIssueEditContext,
} from '../useGithubIssueDescription';

type IssueSection = 'overview' | 'conversation';

type Props = {
  readonly issue: GithubIssue;
  readonly frame?: RecordFrame | null;
  readonly editContext?: GithubIssueEditContext | null;
};

export const GithubIssueDetail = ({ issue, frame = null, editContext }: Props) => {
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
    <PaneShell
      scroll="body"
      header={
        <RecordHeader
          provider="github"
          identifier={`#${issue.number}`}
          title={issue.title}
          state={<StateBadge>{stateWord({ value: issue.state })}</StateBadge>}
          externalRef={{ url: issue.url, label: 'issue' }}
          frame={frame}
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
    >
      <DetailProperties entries={properties} />
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
    </PaneShell>
  );
};
