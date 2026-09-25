import { PaneShell } from '../../../shared/components/PaneShell';
import { RecordHeader } from '../../../shared/components/StudioDetail/RecordHeader';
import { RecordFacts } from '../../../shared/components/StudioDetail/RecordFacts';
import { RecordSections } from '../../../shared/components/StudioDetail/RecordSections';
import type { RecordSection } from '../../../shared/components/StudioDetail/RecordSections/types';
import type { RecordFrame } from '../../../shared/components/StudioDetail/RecordActions/types';
import { useMemo } from 'react';
import type { GithubIssue } from '@goodboy/types';
import { StateBadge } from '@goodboy/ui';
import { githubIssueFields, resolveFacts } from '../../../shared/detail-fields';
import { DescriptionSection } from '../../../shared/components/DescriptionSection';
import { stateWord } from '../../inbox/stateWord';
import { GithubIssueComments } from '../GithubIssueComments';
import { useGithubIssueComments } from '../useGithubIssueComments';
import {
  useGithubIssueDescription,
  type GithubIssueEditContext,
} from '../useGithubIssueDescription';

type Props = {
  readonly issue: GithubIssue;
  readonly frame?: RecordFrame | null;
  readonly editContext?: GithubIssueEditContext | null;
};

export const GithubIssueDetail = ({ issue, frame = null, editContext }: Props) => {
  const { description, save } = useGithubIssueDescription({ issue, editContext });
  const { comments, isLoading, error, post } = useGithubIssueComments({
    workspaceId: editContext?.workspaceId ?? null,
    rootPath: editContext?.rootPath ?? null,
    issueNumber: issue.number,
  });
  const facts = useMemo(
    () => resolveFacts({ registry: githubIssueFields, entity: issue }),
    [issue],
  );

  const sections: ReadonlyArray<RecordSection> = [
    {
      key: 'description',
      kind: 'description',
      label: 'Description',
      isCollapsible: false,
      defaultOpen: true,
      content: <DescriptionSection text={description} onSave={save} />,
    },
    ...(editContext != null
      ? [
          {
            key: 'conversation',
            kind: 'conversation' as const,
            label: 'Conversation',
            count: comments.length,
            isCollapsible: false,
            defaultOpen: true,
            content: (
              <GithubIssueComments
                comments={comments}
                isLoading={isLoading}
                error={error}
                onPost={post}
              />
            ),
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
          facts={<RecordFacts facts={facts} />}
          externalRef={{ url: issue.url, label: 'issue' }}
          frame={frame}
        />
      }
    >
      <RecordSections sections={sections} />
    </PaneShell>
  );
};
