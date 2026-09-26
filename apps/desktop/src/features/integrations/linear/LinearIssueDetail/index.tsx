import { PaneShell } from '../../../../shared/components/PaneShell';
import { RecordHeader } from '../../../../shared/components/StudioDetail/RecordHeader';
import { RecordFacts } from '../../../../shared/components/StudioDetail/RecordFacts';
import { RecordSections } from '../../../../shared/components/StudioDetail/RecordSections';
import type { RecordFrame } from '../../../../shared/components/StudioDetail/RecordActions/types';
import { useMemo } from 'react';
import type { ProjectId, WorkspaceId } from '@goodboy/types';
import { StateBadge } from '@goodboy/ui';
import { DescriptionSection } from '../../../../shared/components/DescriptionSection';
import { ToolImageScope } from '../../../../shared/components/ToolImageScope';
import { linearIssueFields, resolveFacts } from '../../../../shared/detail-fields';
import type { LinearIssue } from '../client';
import { useConversationPane } from '../../../../shared/components/Conversation/useConversationPane';
import type { ConversationSource } from '../../../../shared/components/Conversation/types';
import { LINEAR_CAPABILITIES, linearConversation } from '../linearConversation';
import { useLinearIssueComments } from '../useLinearIssueComments';
import { useLinearIssueDescription } from '../useLinearIssueDescription';

type Props = {
  readonly issue: LinearIssue;
  readonly workspaceId: WorkspaceId;
  readonly projectId?: ProjectId;
  readonly frame?: RecordFrame | null;
};

export const LinearIssueDetail = ({ issue, workspaceId, projectId, frame = null }: Props) => {
  const { comments, isLoading, error, reload, post } = useLinearIssueComments({
    workspaceId,
    issueId: issue.id,
    projectId,
  });
  const { description, save } = useLinearIssueDescription({ issue, workspaceId, projectId });
  const source = useMemo<ConversationSource>(
    () => ({
      toolLabel: 'Linear',
      threads: linearConversation({ comments }),
      capabilities: LINEAR_CAPABILITIES,
      isLoading,
      error,
      onRetry: reload,
      onPost: post == null ? null : ({ body, threadId }) => post({ body, parentId: threadId }),
      onResolve: null,
      resolveError: null,
      emptyDescription: 'This issue has no comments yet.',
      footnote: null,
      composerNote: null,
      renderMessageFooter: null,
    }),
    [comments, isLoading, error, reload, post],
  );
  const conversation = useConversationPane({ source, resetKey: issue.id });

  return (
    <PaneShell
      scroll="body"
      dock={conversation.composer}
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
            content: (
              <ToolImageScope workspaceId={workspaceId} projectId={projectId} provider="linear">
                <DescriptionSection text={description} onSave={save} />
              </ToolImageScope>
            ),
          },
          conversation.section,
        ]}
      />
    </PaneShell>
  );
};
