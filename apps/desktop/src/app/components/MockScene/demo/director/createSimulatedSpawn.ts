import {
  brandId,
  type Agent,
  type AgentId,
  type IsoDateTime,
  type SessionId,
} from '@goodboy/types';
import { AGENT_KIND_META, type AgentKind } from '../../../../../features/session/agent-kind';
import { agentPlace } from '../../../../../store';
import type { AppStore } from '../../../../../store/store';
import type { DirectorStore } from './directorTypes';

type Params = {
  readonly store: DirectorStore;
  readonly send: AppStore['sendTurn'];
  readonly now: () => IsoDateTime;
};

type SpawnArgs = Parameters<AppStore['spawnAgent']>[1];

type PromptParams = {
  readonly store: DirectorStore;
  readonly sessionId: SessionId;
  readonly args: SpawnArgs;
};

type NameParams = {
  readonly kind: AgentKind;
  readonly args: SpawnArgs;
};

const FALLBACK_PROMPT = 'Pick up where the last step left off.';

const promptOf = ({ store, sessionId, args }: PromptParams): string => {
  if (args.initialPrompt !== undefined) {
    return args.initialPrompt;
  }
  const planId = args.triggeredPlanId;
  const plan = (store.getState().sessionPlans[sessionId] ?? []).find(
    (entry) => entry.id === planId,
  );
  return plan === undefined ? FALLBACK_PROMPT : `Implement the plan: ${plan.title}`;
};

const nameOf = ({ kind, args }: NameParams): string => {
  if (args.name !== undefined) {
    return args.name;
  }
  return AGENT_KIND_META[kind].label;
};

export const createSimulatedSpawn =
  ({ store, send, now }: Params): AppStore['spawnAgent'] =>
  async (sessionId, args) => {
    const at = now();
    const existing = store.getState().sessionPhaseRuns[sessionId] ?? [];
    const kind = args.kindOverride ?? 'implementer';
    const agentId = brandId<AgentId>({ value: `demo-spawned-${sessionId}-${existing.length + 1}` });
    const agent: Agent = {
      id: agentId,
      sessionId,
      ordinal: existing.length + 1,
      name: nameOf({ kind, args }),
      status: 'running',
      kind,
      startedAt: at,
      ...(args.parentAgentId === undefined ? {} : { parentAgentId: args.parentAgentId }),
    };
    store.setState((current) => ({
      sessionPhaseRuns: { ...current.sessionPhaseRuns, [sessionId]: [...existing, agent] },
      transcripts: { ...current.transcripts, [agentId]: [] },
    }));
    if (args.focus !== 'none') {
      store.setState((current) => ({
        selectedAgentId: { ...current.selectedAgentId, [sessionId]: agentId },
      }));
      store.getState().navigate({ to: agentPlace({ sessionId, agentId }) });
    }
    void send({ sessionId, agentId, content: promptOf({ store, sessionId, args }) });
    return agentId;
  };
