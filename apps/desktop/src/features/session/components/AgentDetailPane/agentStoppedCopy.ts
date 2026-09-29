import type { Agent, ProviderId } from '@goodboy/types';
import { PROVIDER_LABEL } from '../../../providers/providerLabel';
import { formatClock } from '../../../../shared/utils/time/formatClock';

const SUMMARY_RESUME_PROVIDERS: ReadonlySet<ProviderId> = new Set(['codex', 'cursor', 'gemini']);

type Params = {
  readonly agent: Agent;
  readonly provider: ProviderId;
  readonly isProviderConnected: boolean;
};

export type AgentStoppedCopy = {
  readonly title: string;
  readonly body: string | null;
  readonly canContinue: boolean;
  readonly actionLabel: 'Resume' | 'Continue';
};

const stoppedTitle = ({ agent }: { readonly agent: Agent }): string => {
  const clock = agent.stoppedAt == null ? '' : formatClock({ at: agent.stoppedAt });
  const when = clock === '' ? '' : ` at ${clock}`;
  const lead =
    agent.stoppedBy === 'app' ? `Stopped by restart${when}.` : `You stopped this agent${when}.`;
  return `${lead} What it wrote is kept.`;
};

export const agentStoppedCopy = ({
  agent,
  provider,
  isProviderConnected,
}: Params): AgentStoppedCopy => {
  const label = PROVIDER_LABEL[provider];
  const title = stoppedTitle({ agent });
  const actionLabel = agent.stoppedBy === 'app' ? 'Resume' : 'Continue';
  if (agent.doneAt != null) {
    return { title, body: null, canContinue: false, actionLabel };
  }
  if (!isProviderConnected) {
    return { title, body: `Connect ${label} to continue.`, canContinue: false, actionLabel };
  }
  const body = SUMMARY_RESUME_PROVIDERS.has(provider)
    ? `${label} picks up from a summary of this chat, not from the exact step it stopped on.`
    : null;
  return { title, body, canContinue: true, actionLabel };
};
