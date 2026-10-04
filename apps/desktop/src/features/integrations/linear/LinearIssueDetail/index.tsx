import { PaneShell } from '@goodboy/ui';
import { RecordHeader } from '../../../../shared/components/StudioDetail/RecordHeader';
import { RecordProperties } from '../../../../shared/components/StudioDetail/RecordProperties';
import { RecordSections } from '../../../../shared/components/StudioDetail/RecordSections';
import type { RecordFrame } from '../../../../shared/components/StudioDetail/RecordActions/types';
import { useMemo } from 'react';
import type { ProjectId, WorkspaceId } from '@goodboy/types';
import { DescriptionSection } from '../../../../shared/components/DescriptionSection';
import { ToolImageScope } from '../../../../shared/components/ToolImageScope';
import { linearIssueFields, recordByline, resolveFacts } from '../../../../shared/detail-fields';
import type { FactRegistry, ResolvedFact } from '../../../../shared/detail-fields/factTypes';
import { linearEditableAssigneeFact } from '../../../../shared/detail-fields/linearIssueFields';
import { useAppStore } from '../../../../store';
import { LinearStateMenu } from '../LinearStateMenu';
import { LinearAssigneeMenu } from '../LinearAssigneeMenu';
import { useLinearIssueState } from '../useLinearIssueState';
import { useLinearIssueAssignee } from '../useLinearIssueAssignee';
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
  const { state, change } = useLinearIssueState({ issue, workspaceId, projectId });
  const { assignee, change: changeAssignee } = useLinearIssueAssignee({
    issue,
    workspaceId,
    projectId,
  });
  const reportError = useAppStore((s) => s.reportError);
  const facts = useMemo((): ReadonlyArray<ResolvedFact> => {
    const registry: FactRegistry<LinearIssue> =
      changeAssignee === null
        ? linearIssueFields
        : { ...linearIssueFields, person: linearEditableAssigneeFact };
    return resolveFacts({ registry, entity: { ...issue, state, assignee } }).map((fact) => {
      if (fact.key === 'state' && change !== null) {
        return {
          ...fact,
          editor: ({ close }) => (
            <LinearStateMenu
              workspaceId={workspaceId}
              projectId={projectId}
              issueId={issue.id}
              currentName={state.name}
              onPick={(stateId) =>
                void change(stateId).catch((error: unknown) =>
                  reportError({ title: "Couldn't change the status", error, workspaceId }),
                )
              }
              onClose={close}
            />
          ),
        };
      }
      if (fact.key === 'assignee' && changeAssignee !== null) {
        return {
          ...fact,
          editor: ({ close }) => (
            <LinearAssigneeMenu
              workspaceId={workspaceId}
              projectId={projectId}
              issueId={issue.id}
              currentName={assignee?.name ?? null}
              onPick={(assigneeId) =>
                void changeAssignee(assigneeId).catch((error: unknown) =>
                  reportError({ title: "Couldn't change the assignee", error, workspaceId }),
                )
              }
              onClose={close}
            />
          ),
        };
      }
      return fact;
    });
  }, [issue, state, change, assignee, changeAssignee, workspaceId, projectId, reportError]);
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
          byline={recordByline({
            lead: issue.creator == null ? null : `Opened by ${issue.creator.name}`,
            verb: 'updated',
            iso: issue.updatedAt,
          })}
          facts={<RecordProperties facts={facts} />}
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
