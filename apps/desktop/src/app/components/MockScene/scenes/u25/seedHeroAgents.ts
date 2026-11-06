import type { Agent, ProviderId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { SESSION_ID } from '../activityRunSeed';

type Route = {
  readonly provider: ProviderId;
  readonly model: string;
};

const ROUTES: Readonly<Record<string, Route>> = {
  'mock-run-agent-banner-copy': { provider: 'codex', model: 'gpt-6-astra' },
  'mock-run-agent-banner-states': { provider: 'codex', model: 'gpt-6-astra' },
  'mock-run-agent-console-tests': { provider: 'anthropic', model: 'claude-sonnet-5-5' },
  'mock-run-agent-tester': { provider: 'anthropic', model: 'claude-sonnet-5-5' },
  'mock-resolves-agent-subagent-0': { provider: 'cursor', model: 'composer-2.5' },
  'mock-resolves-agent-subagent-1': { provider: 'cursor', model: 'composer-2.5' },
  'mock-resolves-agent-subagent-2': { provider: 'cursor', model: 'composer-2.5' },
  'mock-resolves-agent-subagent-5': { provider: 'codex', model: 'gpt-6.1-sol' },
};

const RENAMED: Readonly<Record<string, string>> = {
  'claude-sonnet-5': 'claude-sonnet-5-5',
  'gpt-5.6-sol': 'gpt-6.1-sol',
};

type ModelParams = {
  readonly model: string;
};

const renamed = ({ model }: ModelParams): string => RENAMED[model] ?? model;

type AgentParams = {
  readonly agent: Agent;
};

const routed = ({ agent }: AgentParams): Agent => {
  const route = ROUTES[agent.id];
  if (route === undefined) {
    return agent.modelOverride == null
      ? agent
      : { ...agent, modelOverride: renamed({ model: agent.modelOverride }) };
  }
  return { ...agent, providerOverride: route.provider, modelOverride: route.model };
};

export const seedHeroAgents = (): void => {
  useAppStore.setState((state) => ({
    sessionPhaseRuns: {
      ...state.sessionPhaseRuns,
      [SESSION_ID]: (state.sessionPhaseRuns[SESSION_ID] ?? []).map((agent) => routed({ agent })),
    },
    sessionTurnSpans: {
      ...state.sessionTurnSpans,
      [SESSION_ID]: (state.sessionTurnSpans[SESSION_ID] ?? []).map((span) => {
        const route = ROUTES[span.agentId];
        return route === undefined
          ? { ...span, model: renamed({ model: span.model }) }
          : { ...span, provider: route.provider, model: route.model };
      }),
    },
    sessionResolveAttempts: Object.fromEntries(
      Object.entries(state.sessionResolveAttempts).map(([id, attempts]) => [
        id,
        attempts.map((attempt) => ({ ...attempt, model: renamed({ model: attempt.model }) })),
      ]),
    ),
  }));
};
