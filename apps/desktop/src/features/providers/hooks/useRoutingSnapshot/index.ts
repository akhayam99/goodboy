import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { providerLoad, ROOM_TURNS_WINDOW_MS, type CandidateInputs } from '@goodboy/core/providers';
import type { ProviderId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useNow } from '../../../../shared/hooks/useNow';
import { runningAgentsOf } from '../../../../store/runtime/models/runningAgentsOf';
import { selectCandidateInputs } from '../../../../store/runtime/models/selectCandidateInputs';
import { SETTING_HIDDEN_MODELS } from '../../../settings/settings';
import { routingTurns } from './routingTurns';

type Params = {
  readonly workspaceId: WorkspaceId;
};

export type RoutingSnapshot = Readonly<{
  inputs: CandidateInputs;
  lastHours: Readonly<Partial<Record<ProviderId, number>>>;
}>;

const AGENT_SEPARATOR = ',';

const PART_SEPARATOR = ':';

type RunningParams = {
  readonly runningKey: string;
};

const runningOf = ({
  runningKey,
}: RunningParams): ReadonlyArray<Readonly<{ provider: string; agentId: string }>> =>
  runningKey === ''
    ? []
    : runningKey.split(AGENT_SEPARATOR).map((entry) => {
        const [agentId = '', provider = ''] = entry.split(PART_SEPARATOR);
        return { agentId, provider };
      });

export const useRoutingSnapshot = ({ workspaceId }: Params): RoutingSnapshot | null => {
  const overrides = useAppStore((state) => state.workspaceOverrides[workspaceId]);
  const providers = useAppStore((state) => state.providers);
  const limits = useAppStore((state) => state.providerLimits);
  const cooldowns = useAppStore((state) => state.providerCooldowns);
  const alerts = useAppStore((state) => state.budgetAlerts);
  const strikes = useAppStore((state) => state.providerStrikes);
  const hiddenRaw = useAppStore((state) => state.settings[SETTING_HIDDEN_MODELS]);
  const cliRequirements = useAppStore((state) => state.cliRequirements);
  const runningKey = useAppStore((state) =>
    runningAgentsOf({ state })
      .map((agent) => `${agent.agentId}${PART_SEPARATOR}${agent.provider}`)
      .join(AGENT_SEPARATOR),
  );
  const nowMs = useNow(60_000);
  const read = useSyncExternalStore(
    (listener) => routingTurns.subscribe({ listener }),
    routingTurns.current,
  );

  useEffect(() => {
    routingTurns.request({ workspaceId, nowMs, runningKey });
  }, [workspaceId, nowMs, runningKey]);

  return useMemo(() => {
    if (read === null || read.workspaceId !== workspaceId) {
      return null;
    }
    const state = {
      ...useAppStore.getState(),
      workspaceOverrides: overrides === undefined ? {} : { [workspaceId]: overrides },
      providers,
      providerLimits: limits,
      providerCooldowns: cooldowns,
      budgetAlerts: alerts,
      providerStrikes: strikes,
      settings: Object.fromEntries(
        hiddenRaw === undefined ? [] : [[SETTING_HIDDEN_MODELS, hiddenRaw]],
      ),
      cliRequirements,
    };
    return {
      inputs: selectCandidateInputs({
        state,
        workspaceId,
        nowMs: read.nowMs,
        turns: read.turns,
      }),
      lastHours: providerLoad({
        finished: read.turns,
        running: runningOf({ runningKey }),
        sinceMs: read.nowMs - ROOM_TURNS_WINDOW_MS,
      }),
    };
  }, [
    read,
    workspaceId,
    overrides,
    providers,
    limits,
    cooldowns,
    alerts,
    strikes,
    hiddenRaw,
    cliRequirements,
    runningKey,
  ]);
};
