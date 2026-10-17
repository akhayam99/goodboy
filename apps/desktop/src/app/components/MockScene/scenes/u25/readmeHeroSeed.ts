import type { Agent, ProviderId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { openPaneOf } from '../../../../../features/session/panes/openPaneOf';
import { togglePane } from '../../../../../features/session/panes/togglePane';
import { SESSION_ID } from '../activityRunSeed';
import { seedBrandLimits } from '../brand/limitsSeed';
import { seedR4Rail } from './r4RailSeed';

type Route = {
  readonly provider: ProviderId;
  readonly model: string;
};

const ROUTES: Readonly<Record<string, Route>> = {
  'mock-run-agent-banner-copy': { provider: 'codex', model: 'gpt-6-astra' },
  'mock-run-agent-banner-states': { provider: 'codex', model: 'gpt-6-astra' },
  'mock-run-agent-console-tests': { provider: 'anthropic', model: 'claude-sonnet-5' },
  'mock-run-agent-tester': { provider: 'anthropic', model: 'claude-sonnet-5' },
  'mock-resolves-agent-subagent-0': { provider: 'cursor', model: 'composer-2.5' },
  'mock-resolves-agent-subagent-1': { provider: 'cursor', model: 'composer-2.5' },
  'mock-resolves-agent-subagent-2': { provider: 'cursor', model: 'composer-2.5' },
  'mock-resolves-agent-subagent-5': { provider: 'codex', model: 'gpt-6.1-sol' },
};

const HERO_GOAL =
  'Key every credit on the processor event id so a retried webhook never posts twice, and show support a stuck delivery in notify-relay.';

type AgentParams = {
  readonly agent: Agent;
};

const routed = ({ agent }: AgentParams): Agent => {
  const route = ROUTES[agent.id];
  if (route === undefined) {
    return agent;
  }
  return { ...agent, providerOverride: route.provider, modelOverride: route.model };
};

const seedHeroAgents = (): void => {
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
          ? span
          : { ...span, provider: route.provider, model: route.model };
      }),
    },
  }));
};

const seedHeroGoal = (): void => {
  useAppStore.setState((state) => ({
    sessionSlots: {
      ...state.sessionSlots,
      [SESSION_ID]: (state.sessionSlots[SESSION_ID] ?? []).map((slot) =>
        slot.key === 'goal' ? { ...slot, value: HERO_GOAL } : slot,
      ),
    },
  }));
};

const openContext = (): void => {
  if (openPaneOf({ state: useAppStore.getState(), sessionId: SESSION_ID }) === 'context') {
    return;
  }
  togglePane({ sessionId: SESSION_ID, pane: 'context' });
};

export const seedReadmeHero = (): void => {
  const items = useAppStore.getState().sessionResolveQueueItems[SESSION_ID];
  seedR4Rail({ isCardFolded: false });
  if (items !== undefined) {
    useAppStore.setState((state) => ({
      sessionResolveQueueItems: { ...state.sessionResolveQueueItems, [SESSION_ID]: items },
    }));
  }
  seedBrandLimits();
  seedHeroAgents();
  seedHeroGoal();
  openContext();
};
