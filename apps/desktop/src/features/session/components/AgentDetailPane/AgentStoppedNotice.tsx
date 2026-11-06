import { Button, Notice } from '@goodboy/ui';
import type { Agent, ProviderId, ProviderName, Session } from '@goodboy/types';
import { useAppStore, useExecutedAgentRouting } from '../../../../store';
import { DockStateLine } from '../../../../shared/components/DockStateLine';
import { usePendingAction } from '../../../../shared/hooks/usePendingAction';
import { NAMES } from '../../../../shared/utils/names';
import { glanceOf } from '../../glance/glanceOf';
import { agentStoppedCopy } from './agentStoppedCopy';

type Props = {
  readonly session: Session;
  readonly agent: Agent;
  readonly isAutoChild: boolean;
  readonly isDocked: boolean;
  readonly isRunStep: boolean;
};

type ProviderParams = Pick<Props, 'session'> & {
  readonly executedProvider: ProviderName | null;
  readonly providerOverride: ProviderId | null;
};

const STOPPED_TONE = glanceOf({ state: 'stopped', sentence: '' }).tone;

const stoppedProvider = ({
  session,
  executedProvider,
  providerOverride,
}: ProviderParams): ProviderId =>
  executedProvider == null || executedProvider === 'openai'
    ? (providerOverride ?? session.providerPreference.defaultProvider)
    : executedProvider;

export const AgentStoppedNotice = ({ session, agent, isAutoChild, isDocked, isRunStep }: Props) => {
  const continueStoppedAgent = useAppStore((state) => state.continueStoppedAgent);
  const authResults = useAppStore((state) => state.authResults);
  const pending = usePendingAction({ sessionId: session.id });
  const executed = useExecutedAgentRouting({ agent });
  const providerOverride = useAppStore(
    (state) => state.agentProviderOverride[agent.id] ?? agent.providerOverride ?? null,
  );
  if (agent.status !== 'stopped') {
    return null;
  }
  const provider = stoppedProvider({
    session,
    executedProvider: executed?.provider ?? null,
    providerOverride,
  });
  const isProviderConnected = authResults?.[provider]?.state !== 'disconnected';
  const copy = agentStoppedCopy({ agent, provider, isProviderConnected, isAutoChild, isRunStep });
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
