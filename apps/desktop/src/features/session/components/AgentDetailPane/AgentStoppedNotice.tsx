import { Button, Notice } from '@goodboy/ui';
import type { Agent, ProviderId, ProviderName, Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { usePendingAction } from '../../../../shared/hooks/usePendingAction';
import { agentStoppedCopy } from './agentStoppedCopy';

type Props = {
  readonly session: Session;
  readonly agent: Agent;
  readonly executedProvider: ProviderName | null;
  readonly providerOverride: ProviderId | null;
  readonly isAutoChild: boolean;
};

type ProviderParams = Omit<Props, 'agent' | 'isAutoChild'>;

const stoppedProvider = ({
  session,
  executedProvider,
  providerOverride,
}: ProviderParams): ProviderId =>
  executedProvider == null || executedProvider === 'openai'
    ? (providerOverride ?? session.providerPreference.defaultProvider)
    : executedProvider;

export const AgentStoppedNotice = ({
  session,
  agent,
  executedProvider,
  providerOverride,
  isAutoChild,
}: Props) => {
  const continueStoppedAgent = useAppStore((state) => state.continueStoppedAgent);
  const authResults = useAppStore((state) => state.authResults);
  const pending = usePendingAction({ sessionId: session.id });
  if (agent.status !== 'stopped') {
    return null;
  }
  const provider = stoppedProvider({ session, executedProvider, providerOverride });
  const isProviderConnected = authResults?.[provider]?.state !== 'disconnected';
  const copy = agentStoppedCopy({ agent, provider, isProviderConnected, isAutoChild });
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
