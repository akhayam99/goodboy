import { Button, cn, tintClasses } from '@goodboy/ui';
import type { Agent, ProviderId, ProviderName, Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { agentStoppedCopy } from './agentStoppedCopy';

type Props = {
  readonly session: Session;
  readonly agent: Agent;
  readonly executedProvider: ProviderName | null;
  readonly providerOverride: ProviderId | null;
};

type ProviderParams = Omit<Props, 'agent'>;

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
}: Props) => {
  const continueStoppedAgent = useAppStore((state) => state.continueStoppedAgent);
  const authResults = useAppStore((state) => state.authResults);
  if (agent.status !== 'stopped') {
    return null;
  }
  const provider = stoppedProvider({ session, executedProvider, providerOverride });
  const isProviderConnected = authResults?.[provider]?.state !== 'disconnected';
  const copy = agentStoppedCopy({ agent, provider, isProviderConnected });
  const tint = tintClasses('neutral');
  const Icon = CONCEPT_ICONS.runStopped;
  return (
    <div
      role="status"
      data-agent-stopped
      className="relative flex w-full min-w-0 items-start gap-2.5 overflow-hidden rounded-lg border border-border-soft bg-subtle py-2.5 pl-3.5 pr-3"
    >
      <span aria-hidden className={cn('absolute inset-y-0 left-0 w-0.5', tint.dot)} />
      <Icon size={ICON_SIZE.control} aria-hidden className={cn('mt-px shrink-0', tint.icon)} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-label font-semibold text-foreground">{copy.title}</p>
        {copy.body == null ? null : <p className="text-label text-muted-foreground">{copy.body}</p>}
      </div>
      {copy.canContinue ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void continueStoppedAgent({ sessionId: session.id, agentId: agent.id })}
        >
          Continue
        </Button>
      ) : null}
    </div>
  );
};
