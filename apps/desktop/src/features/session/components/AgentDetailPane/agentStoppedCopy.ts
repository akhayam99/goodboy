import type { Agent, ProviderId } from '@goodboy/types';
import { PROVIDER_LABEL } from '../../../providers/providerLabel';
import { stoppedSentenceOf } from '../../glance/stoppedSentenceOf';

const SUMMARY_RESUME_PROVIDERS: ReadonlySet<ProviderId> = new Set(['codex', 'cursor', 'gemini']);

const AUTO_READS = 'Auto reads the result.';

const RUN_PAUSED = 'The run is paused.';

type Params = {
  readonly agent: Agent;
  readonly provider: ProviderId;
  readonly isProviderConnected: boolean;
  readonly isAutoChild: boolean;
  readonly isRunStep: boolean;
};

export type AgentStoppedCopy = {
  readonly title: string;
  readonly body: string | null;
  readonly canContinue: boolean;
};

export const agentStoppedCopy = ({
  agent,
  provider,
  isProviderConnected,
  isAutoChild,
  isRunStep,
}: Params): AgentStoppedCopy => {
  const label = PROVIDER_LABEL[provider];
  if (isRunStep) {
    return {
      title: stoppedSentenceOf({ agent, kept: RUN_PAUSED }),
      body: null,
      canContinue: false,
    };
  }
  if (isAutoChild) {
    return {
      title: stoppedSentenceOf({ agent, kept: AUTO_READS }),
      body: null,
      canContinue: agent.doneAt == null,
    };
  }
  const title = stoppedSentenceOf({ agent });
  if (agent.doneAt != null) {
    return { title, body: null, canContinue: false };
  }
  if (!isProviderConnected) {
    return { title, body: `Connect ${label} to continue.`, canContinue: false };
  }
  const body = SUMMARY_RESUME_PROVIDERS.has(provider)
    ? `${label} picks up from a summary of this chat, not from the exact step it stopped on.`
    : null;
  return { title, body, canContinue: true };
};
