import { Button, Notice } from '@goodboy/ui';
import type { Agent, Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { DockStateLine } from '../../../../shared/components/DockStateLine';
import { usePendingAction } from '../../../../shared/hooks/usePendingAction';
import { NAMES } from '../../../../shared/utils/names';
import { glanceOf } from '../../glance/glanceOf';
import { useAgentStoppedCopy } from './useAgentStoppedCopy';

type Props = {
  readonly session: Session;
  readonly agent: Agent;
  readonly isAutoChild: boolean;
  readonly isDocked: boolean;
  readonly isRunStep: boolean;
};

const STOPPED_TONE = glanceOf({ state: 'stopped', sentence: '' }).tone;

export const AgentStoppedNotice = ({ session, agent, isAutoChild, isDocked, isRunStep }: Props) => {
  const continueStoppedAgent = useAppStore((state) => state.continueStoppedAgent);
  const pending = usePendingAction({ sessionId: session.id });
  const { copy } = useAgentStoppedCopy({ session, agent, isAutoChild, isRunStep });
  if (agent.status !== 'stopped') {
    return null;
  }
  const action = copy.canContinue ? (
    <Button
      variant={isDocked ? 'primary' : 'secondary'}
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
      {NAMES.continue}
    </Button>
  ) : undefined;
  if (isDocked) {
    return (
      <DockStateLine state="stopped" tone={STOPPED_TONE} sentence={copy.title} note={copy.body}>
        {action}
      </DockStateLine>
    );
  }
  return (
    <div data-agent-stopped="">
      <Notice
        tone="info"
        placement="inline"
        role="status"
        title={copy.title}
        body={copy.body ?? undefined}
        actions={action}
      />
    </div>
  );
};
