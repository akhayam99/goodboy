import { PROVIDER_CAPABILITIES } from '@goodboy/core';
import type { ProviderId, SessionId } from '@goodboy/types';
import { invokeAgentList } from '../../../features/workflows/workflows';
import type { SetFn } from './types';

const PROVIDER_IDS: ReadonlyArray<ProviderId> = Object.keys(PROVIDER_CAPABILITIES).filter(
  (id): id is ProviderId => id in PROVIDER_CAPABILITIES,
);

export const loadPhaseRunsForSession = (set: SetFn) => {
  return async (sessionId: SessionId) => {
    const runs = await invokeAgentList(sessionId);
    set((state) => {
      const modelOverrides = { ...state.agentModelOverride };
      const providerOverrides = { ...state.agentProviderOverride };
      const effortOverrides = { ...state.agentEffortOverride };
      for (const run of runs) {
        if (run.modelOverride != null && modelOverrides[run.id] == null) {
          modelOverrides[run.id] = run.modelOverride;
        }
        const provider = PROVIDER_IDS.find((id) => id === run.providerOverride);
        if (provider != null && providerOverrides[run.id] == null) {
          providerOverrides[run.id] = provider;
        }
        if (run.effort != null && effortOverrides[run.id] == null) {
          effortOverrides[run.id] = run.effort;
        }
      }
      return {
        sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: runs },
        agentModelOverride: modelOverrides,
        agentProviderOverride: providerOverrides,
        agentEffortOverride: effortOverrides,
      };
    });
  };
};
