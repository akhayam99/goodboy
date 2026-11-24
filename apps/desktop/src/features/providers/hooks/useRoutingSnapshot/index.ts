import { useEffect, useState } from 'react';
import { providerLoad, ROOM_TURNS_WINDOW_MS, type CandidateInputs } from '@goodboy/core/providers';
import type { ProviderId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useNow } from '../../../../shared/hooks/useNow';
import { readProviderAgentTurns } from '../../../../store/runtime/models/readProviderAgentTurns';
import { runningAgentsOf } from '../../../../store/runtime/models/runningAgentsOf';
import { selectCandidateInputs } from '../../../../store/runtime/models/selectCandidateInputs';

type Params = {
  readonly workspaceId: WorkspaceId;
};

export type RoutingSnapshot = Readonly<{
  inputs: CandidateInputs;
  lastHours: Readonly<Partial<Record<ProviderId, number>>>;
}>;

export const useRoutingSnapshot = ({ workspaceId }: Params): RoutingSnapshot | null => {
  const overrides = useAppStore((state) => state.workspaceOverrides[workspaceId]);
  const providers = useAppStore((state) => state.providers);
  const limits = useAppStore((state) => state.providerLimits);
  const cooldowns = useAppStore((state) => state.providerCooldowns);
  const alerts = useAppStore((state) => state.budgetAlerts);
  const strikes = useAppStore((state) => state.providerStrikes);
  const nowMs = useNow(60_000);
  const [snapshot, setSnapshot] = useState<RoutingSnapshot | null>(null);

  useEffect(() => {
    let isCurrent = true;
    void readProviderAgentTurns({ nowMs }).then((turns) => {
      if (!isCurrent) {
        return;
      }
      const state = useAppStore.getState();
      setSnapshot({
        inputs: selectCandidateInputs({ state, workspaceId, nowMs, turns }),
        lastHours: providerLoad({
          finished: turns,
          running: runningAgentsOf({ state }),
          sinceMs: nowMs - ROOM_TURNS_WINDOW_MS,
        }),
      });
    });
    return () => {
      isCurrent = false;
    };
  }, [workspaceId, nowMs, overrides, providers, limits, cooldowns, alerts, strikes]);

  return snapshot;
};
