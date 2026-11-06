import { Button, Notice } from '@goodboy/ui';
import type { Agent, Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { usePendingAction } from '../../../../shared/hooks/usePendingAction';
import { useAgentStoppedCopy } from './useAgentStoppedCopy';

type Props = {
  readonly session: Session;
  readonly agent: Agent;
  readonly isAutoChild: boolean;
};

export const AgentStoppedNotice = ({ session, agent, isAutoChild }: Props) => {
  const continueStoppedAgent = useAppStore((state) => state.continueStoppedAgent);
  const pending = usePendingAction({ sessionId: session.id });
  const { copy } = useAgentStoppedCopy({ session, agent, isAutoChild });
  if (agent.status !== 'stopped') {
    return null;
  }
  return (
    <div data-agent-stopped="">
      <Notice
        tone="info"
        placement="inline"
        role="status"
        title={copy.title}
        body={copy.body ?? undefined}
        actions={
          copy.canContinue ? (
            <Button
              variant="secondary"
              size="sm"
              isBusy={pending.pendingKeys.has(agent.id)}
              onClick={() =>
                void pending.run({
                  key: agent.id,
                  failureTitle: "Couldn't continue the agent",
                  task: () => continueStoppedAgent({ sessionId: session.id, agentId: agent.id }),
                })
              }
            >
              {copy.actionLabel}
            </Button>
          ) : undefined
        }
      />
    </div>
  );
};
