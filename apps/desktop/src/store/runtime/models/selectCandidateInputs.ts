import {
  mergeLayers,
  providerLoad,
  providerRoom,
  ROOM_RECENT_WINDOW_MS,
  type CandidateInputs,
  type CandidateRoom,
} from '@goodboy/core/providers';
import type { ProviderAgentTurns } from '@goodboy/db';
import { DEFAULT_WORKFLOW_RULES, type ProviderId, type SessionId } from '@goodboy/types';
import { workflowAvailabilitySnapshot } from '../../../features/workflows/workflowAvailabilitySnapshot';
import type { AppStore } from '../../store';
import { workspaceRulesFor } from '../../slices/workflows/runLimit/workspaceRulesFor';
import { selectModelContext, type ModelState } from './selectModelContext';

export type CandidateState = ModelState &
  Pick<
    AppStore,
    'providerCooldowns' | 'budgetAlerts' | 'providerStrikes' | 'sessionPhaseRuns' | 'runRouting'
  >;

type RunningParams = {
  readonly state: Pick<CandidateState, 'sessionPhaseRuns' | 'runRouting'>;
};

const runningAgentsOf = ({
  state,
}: RunningParams): ReadonlyArray<Readonly<{ provider: string; agentId: string }>> =>
  Object.values(state.sessionPhaseRuns ?? {}).flatMap((agents) =>
    agents.flatMap((agent) => {
      if (agent.status !== 'running' || agent.runId === undefined) {
        return [];
      }
      const provider = state.runRouting?.[agent.id]?.[agent.runId]?.provider;
      return provider === undefined ? [] : [{ provider, agentId: agent.id }];
    }),
  );

type Params = {
  readonly state: CandidateState;
  readonly sessionId: SessionId;
  readonly nowMs: number;
  readonly turns: ReadonlyArray<ProviderAgentTurns>;
};

export const selectCandidateInputs = ({
  state,
  sessionId,
  nowMs,
  turns,
}: Params): CandidateInputs => {
  const scope = selectModelContext({ state, sessionId, nowMs });
  const merged = mergeLayers(scope.layers);
  const providers = state.providers ?? [];
  const connected = providers
    .filter((provider) => provider.connection === 'connected')
    .map((provider) => provider.id);
  const availability = workflowAvailabilitySnapshot({
    providers,
    cooldowns: state.providerCooldowns ?? {},
    alerts: state.budgetAlerts ?? [],
    hidden: null,
    sessionId,
    isRunBudgetBlocked: false,
    nowMs,
  });
  const load = providerLoad({
    finished: turns,
    running: runningAgentsOf({ state }),
    sinceMs: nowMs - ROOM_RECENT_WINDOW_MS,
  });
  const room: Partial<Record<ProviderId, CandidateRoom>> = Object.fromEntries(
    connected.map((providerId) => [
      providerId,
      providerRoom({
        providerId,
        limits: state.providerLimits?.[providerId],
        cleanTurns: turns
          .filter((turn) => turn.provider === providerId)
          .reduce((sum, turn) => sum + turn.cleanTurns, 0),
        load: load[providerId] ?? 0,
        lastRateLimitAtMs: state.providerStrikes?.[providerId] ?? null,
        nowMs,
      }),
    ]),
  );
  const rules =
    scope.workspaceId === null
      ? DEFAULT_WORKFLOW_RULES
      : workspaceRulesFor({ state, workspaceId: scope.workspaceId });
  const { context } = scope;
  return {
    defaultProvider: merged.defaultProviderId ?? context.defaultProvider ?? 'anthropic',
    connected,
    ...(context.atLimit != null && { atLimit: context.atLimit }),
    ...(context.hidden != null && { hidden: context.hidden }),
    ...(context.cliVersions != null && { cliVersions: context.cliVersions }),
    ...(context.learned != null && { learned: context.learned }),
    ...(merged.providerPool !== null && { policy: merged.providerPool }),
    rule: rules.spreadByHeadroom ? 'load' : 'order',
    coolingDown: availability.coolingDownProviders,
    budgetBlocked: availability.budgetBlockedProviders,
    breakerOpen: providers
      .filter((provider) => provider.connection === 'connected' && provider.isBreakerOpen === true)
      .map((provider) => provider.id),
    runProviders: null,
    room,
    load,
    rolePins: merged.roleModels,
  };
};
