import type { Agent, AgentId, SessionId } from '@goodboy/types';
import { updateAgentConfig as updateAgentConfigInDb } from '@goodboy/db';
import type { AgentConfigUpdate } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

export function setAgentConfig(set: SetFn, get: GetFn) {
  return async (sessionId: SessionId, agentId: AgentId, fields: AgentConfigUpdate) => {
    const prevRuns = get().sessionPhaseRuns[sessionId] ?? [];
    const prevAgent = prevRuns.find((r) => r.id === agentId);
    if (!prevAgent) return;
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
      return {
        sessionPhaseRuns: {
          ...state.sessionPhaseRuns,
          [sessionId]: runs.map((r) => (r.id === agentId ? applyFields(r) : r)),
        },
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
      }));
      throw err;
    }
  };
}
