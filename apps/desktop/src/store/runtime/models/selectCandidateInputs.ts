import {
  mergeLayers,
  providerLoad,
  providerRoom,
  ROOM_RECENT_WINDOW_MS,
  type CandidateInputs,
  type CandidateRoom,
} from '@goodboy/core/providers';
import type { ProviderAgentTurns } from '@goodboy/db';
import {
  DEFAULT_WORKFLOW_RULES,
  type ProviderId,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';
import { workflowAvailabilitySnapshot } from '../../../features/workflows/workflowAvailabilitySnapshot';
import type { AppStore } from '../../store';
import { selectNoAccessModels } from '../../slices/providers/selectNoAccessModels';
import { workspaceRulesFor } from '../../slices/workflows/runLimit/workspaceRulesFor';
import { runningAgentsOf } from './runningAgentsOf';
import { selectModelContext, type ModelState } from './selectModelContext';

export type CandidateState = ModelState &
  Pick<
    AppStore,
    'providerCooldowns' | 'budgetAlerts' | 'providerStrikes' | 'sessionPhaseRuns' | 'runRouting'
  >;

type Params = {
  readonly state: CandidateState;
  readonly sessionId?: SessionId | null;
  readonly workspaceId?: WorkspaceId | null;
  readonly nowMs: number;
  readonly turns: ReadonlyArray<ProviderAgentTurns>;
};

export const selectCandidateInputs = ({
  state,
  sessionId = null,
  workspaceId = null,
  nowMs,
  turns,
}: Params): CandidateInputs => {
  const scope = selectModelContext({ state, sessionId, workspaceId, nowMs });
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
  const noAccess = selectNoAccessModels({ state, nowMs });
  return {
    defaultProvider: merged.defaultProviderId ?? context.defaultProvider ?? 'anthropic',
    connected,
    ...(context.atLimit != null && { atLimit: context.atLimit }),
    ...(context.hidden != null && { hidden: context.hidden }),
    ...(Object.keys(noAccess).length > 0 && { noAccess }),
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
