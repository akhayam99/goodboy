import { PaneShell } from '../../../../shared/components/PaneShell';
import { RecordHeader } from '../../../../shared/components/StudioDetail/RecordHeader';
import { RecordFacts } from '../../../../shared/components/StudioDetail/RecordFacts';
import { RecordSections } from '../../../../shared/components/StudioDetail/RecordSections';
import type { RecordFrame } from '../../../../shared/components/StudioDetail/RecordActions/types';
import { useMemo } from 'react';
import type { ProjectId, WorkspaceId } from '@goodboy/types';
import { StateBadge } from '@goodboy/ui';
import { DescriptionSection } from '../../../../shared/components/DescriptionSection';
import { jiraIssueFields, resolveFacts } from '../../../../shared/detail-fields';
import type { JiraIssue } from '../client';
import { statusCategoryTone } from '../statusCategoryTone';
import { useJiraIssueActions } from '../useJiraIssueActions';
import { useJiraIssueComments } from '../useJiraIssueComments';
import { AssigneePicker } from '../AssigneePicker';
import { TransitionMenu } from '../TransitionMenu';
import { useConversationPane } from '../../../../shared/components/Conversation/useConversationPane';
import type { ConversationSource } from '../../../../shared/components/Conversation/types';
import { JIRA_CAPABILITIES, jiraConversation } from '../jiraConversation';

type Props = {
  readonly issue: JiraIssue;
  readonly workspaceId: WorkspaceId;
  readonly projectId?: ProjectId;
  readonly frame?: RecordFrame | null;
  readonly onIssueWritten?: (() => void) | null;
};

export const JiraIssueDetail = ({
  issue,
  workspaceId,
  projectId,
  frame = null,
  onIssueWritten,
}: Props) => {
  const actions = useJiraIssueActions({ issue, workspaceId, projectId, onWritten: onIssueWritten });
  const live = actions.issue;
  const { comments, isLoading, error, reload, post } = useJiraIssueComments({
    issue: live,
    workspaceId,
    projectId,
  });
  const source = useMemo<ConversationSource>(() => {
    const flat = jiraConversation({ comments });
    return {
      toolLabel: 'Jira',
      threads: flat.threads,
      capabilities: JIRA_CAPABILITIES,
      isLoading,
      error,
      onRetry: reload,
      onPost: post == null ? null : ({ body }) => post(body),
      onResolve: null,
      resolveError: null,
      emptyDescription: 'Comments on this issue show up here.',
      footnote: flat.footnote,
      composerNote: 'Plain text, one paragraph per line',
      renderMessageFooter: null,
    };
  }, [comments, isLoading, error, reload, post]);
  const conversation = useConversationPane({ source, resetKey: live.key });
  const tone = statusCategoryTone({ statusCategory: live.statusCategory });
  const assign = actions.assign;
  const facts = resolveFacts({ registry: jiraIssueFields, entity: live });
  const withPicker =
    assign == null
      ? facts
      : [
          {
            slot: 'person' as const,
            key: 'assignee',
            label: 'Assignee',
            icon: null,
            node: (
              <AssigneePicker
                issueKey={live.key}
                workspaceId={workspaceId}
                assignee={live.assignee}
                onAssign={assign}
              />
            ),
          },
          ...facts.filter((fact) => fact.slot !== 'person'),
        ];

  return (
    <PaneShell
      scroll="body"
      dock={conversation.composer}
      header={
        <RecordHeader
          provider="jira"
          identifier={live.key}
          title={live.summary}
          state={
            actions.transition != null ? (
              <TransitionMenu
                issueKey={live.key}
                workspaceId={workspaceId}
                onTransition={actions.transition}
                state={{ label: live.status, tone }}
              />
            ) : (
              <StateBadge tone={tone}>{live.status}</StateBadge>
            )
          }
          facts={<RecordFacts facts={withPicker} />}
          externalRef={{ url: live.url, label: 'issue' }}
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
            content: (
              <DescriptionSection text={live.description} onSave={actions.saveDescription} />
            ),
          },
          conversation.section,
        ]}
      />
    </PaneShell>
  );
};
