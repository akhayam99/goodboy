import type { Agent, AgentId, SessionId } from '@goodboy/types';
import { updateAgentConfig as updateAgentConfigInDb } from '@goodboy/db';
import type { AgentConfigUpdate } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

export const setAgentConfig = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, agentId: AgentId, fields: AgentConfigUpdate) => {
    const prevRuns = get().sessionPhaseRuns[sessionId] ?? [];
    const prevAgent = prevRuns.find((r) => r.id === agentId);
    if (!prevAgent) {
      return;
    }
    const prevModelOverride = get().agentModelOverride;
    const prevProviderOverride = get().agentProviderOverride;
    const prevEffortOverride = get().agentEffortOverride;
    const applyFields = (a: Agent): Agent => {
      const { verbosity, effort, modelOverride, providerOverride, ...rest } = a;
      const nextVerbosity = fields.verbosity !== undefined ? fields.verbosity : (verbosity ?? null);
      const nextEffort = fields.effort !== undefined ? fields.effort : (effort ?? null);
      const nextModel =
        fields.modelOverride !== undefined ? fields.modelOverride : (modelOverride ?? null);
      const nextProvider =
        fields.providerOverride !== undefined
          ? fields.providerOverride
          : (providerOverride ?? null);
      return {
        ...rest,
        ...(nextVerbosity != null && { verbosity: nextVerbosity }),
        ...(nextEffort != null && { effort: nextEffort }),
        ...(nextModel != null && { modelOverride: nextModel }),
        ...(nextProvider != null && { providerOverride: nextProvider }),
      };
    };
    set((state) => {
      const runs = state.sessionPhaseRuns[sessionId] ?? [];
      const nextModelOverride = { ...state.agentModelOverride };
      const nextProviderOverride = { ...state.agentProviderOverride };
      const nextEffortOverride = { ...state.agentEffortOverride };
      if (fields.modelOverride !== undefined) {
        if (fields.modelOverride != null) {
          nextModelOverride[agentId] = fields.modelOverride;
        } else {
          delete nextModelOverride[agentId];
        }
      }
      if (fields.providerOverride !== undefined) {
        if (fields.providerOverride != null) {
          nextProviderOverride[agentId] = fields.providerOverride;
        } else {
          delete nextProviderOverride[agentId];
        }
      }
      if (fields.effort !== undefined) {
        if (fields.effort != null) {
          nextEffortOverride[agentId] = fields.effort;
        } else {
          delete nextEffortOverride[agentId];
        }
      }
      return {
        sessionPhaseRuns: {
          ...state.sessionPhaseRuns,
          [sessionId]: runs.map((r) => (r.id === agentId ? applyFields(r) : r)),
        },
        agentModelOverride: nextModelOverride,
        agentProviderOverride: nextProviderOverride,
        agentEffortOverride: nextEffortOverride,
      };
    });
    try {
      await updateAgentConfigInDb(tauriDatabase, agentId, fields);
    } catch (err) {
      set((state) => ({
        sessionPhaseRuns: {
          ...state.sessionPhaseRuns,
          [sessionId]: prevRuns,
        },
        agentModelOverride: prevModelOverride,
        agentProviderOverride: prevProviderOverride,
        agentEffortOverride: prevEffortOverride,
      }));
      throw err;
    }
  };
};
