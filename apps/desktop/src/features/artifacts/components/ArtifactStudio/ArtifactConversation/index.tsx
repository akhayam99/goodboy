import { useEffect } from 'react';
import { Button, Divider, cn } from '@goodboy/ui';
import { PANE_RHYTHM } from '@goodboy/ui';
import type { Agent, SessionArtifact, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { ChatView } from '../../../../chat/components/ChatView';
import { appendArtifactAttachment } from '../../../artifactConversationAttachment';
import { ArtifactCreateAnother } from '../ArtifactCreateAnother';

type Props = {
  readonly sessionId: SessionId;
  readonly artifact: SessionArtifact;
  readonly agent: Agent | null;
  readonly isWorkflowOwned: boolean;
};

export const ArtifactConversation = ({ sessionId, artifact, agent, isWorkflowOwned }: Props) => {
  const agentId = artifact.agentId;
  const session = useAppStore((s) => s.sessions?.find((entry) => entry.id === sessionId) ?? null);
  const isActive = useAppStore((s) => s.currentSessionId === sessionId);
  const draft = useAppStore((s) => s.agentDraft?.[agentId] ?? '');
  const setAgentDraft = useAppStore((s) => s.setAgentDraft);
  const openArtifactConversation = useAppStore((s) => s.openArtifactConversation);
  const closeArtifactConversation = useAppStore((s) => s.closeArtifactConversation);
  const hasAgent = agent !== null;

  useEffect(() => {
    if (!hasAgent) {
      return;
    }
    openArtifactConversation({ sessionId, agentId });
    return () => closeArtifactConversation({ sessionId, agentId });
  }, [hasAgent, sessionId, agentId, openArtifactConversation, closeArtifactConversation]);

  const attach = () => {
    setAgentDraft(agentId, appendArtifactAttachment({ draft, artifact }));
  };

  const followUpNote = isWorkflowOwned
    ? 'this is the step transcript. a follow up adds another output, it does not rewrite this artifact.'
    : 'a follow up adds another output, it does not rewrite this artifact.';

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className={cn('flex shrink-0 flex-col gap-2', PANE_RHYTHM.dock)}>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-baseline gap-2">
            <span
              data-testid="artifact-conversation-recipient"
              className="shrink-0 text-xs text-foreground"
            >
              {agent === null
                ? 'the agent behind this artifact is gone'
                : `writing to ${agent.name}`}
            </span>
            <span className="min-w-0 truncate text-2xs text-muted-foreground" title={followUpNote}>
              {followUpNote}
            </span>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={attach}
              disabled={!hasAgent}
              data-testid="artifact-attach"
              title="the agent does not see your edits until you attach the artifact"
            >
              Attach {artifact.kind}
            </Button>
            <ArtifactCreateAnother
              sessionId={sessionId}
              artifact={artifact}
              isWorkflowOwned={isWorkflowOwned}
            />
          </div>
        </div>
      </div>
      <Divider />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {session === null || !hasAgent ? (
          <div className={cn('text-2xs text-muted-foreground', PANE_RHYTHM.body)}>
            no conversation to show. this artifact has no agent to talk to in this session.
          </div>
        ) : (
          <ChatView session={session} isActive={isActive} header={null} />
        )}
      </div>
    </div>
  );
};
