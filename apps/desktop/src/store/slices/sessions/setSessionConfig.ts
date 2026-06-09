import type { Session, SessionId } from '@goodboy/types';
import { updateSessionConfig as updateSessionConfigInDb } from '@goodboy/db';
import type { SessionConfigUpdate } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

export const setSessionConfig = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, fields: SessionConfigUpdate) => {
    const prev = get().sessions.find((s) => s.id === sessionId);
    if (!prev) return;
    const applyFields = (s: Session): Session => {
      const { verbosity, effort, modelOverride, providerOverride, ...rest } = s;
      const next: Session = { ...rest } as Session;
      const nextVerbosity = fields.verbosity !== undefined ? fields.verbosity : (verbosity ?? null);
      const nextEffort = fields.effort !== undefined ? fields.effort : (effort ?? null);
      const nextModel =
        fields.modelOverride !== undefined ? fields.modelOverride : (modelOverride ?? null);
      // Changing the session-level default in db clears provider_override; mirror
      // that here so the ChatInput pill drops back to "session default" too.
      const nextProvider =
        fields.defaultProvider !== undefined && fields.defaultProvider !== null
          ? null
          : fields.providerOverride !== undefined
            ? fields.providerOverride
            : (providerOverride ?? null);
      const nextPreference =
        fields.defaultProvider !== undefined && fields.defaultProvider !== null
          ? { ...s.providerPreference, defaultProvider: fields.defaultProvider }
          : s.providerPreference;
      return {
        ...next,
        providerPreference: nextPreference,
        ...(nextVerbosity != null && { verbosity: nextVerbosity }),
        ...(nextEffort != null && { effort: nextEffort }),
        ...(nextModel != null && { modelOverride: nextModel }),
        ...(nextProvider != null && { providerOverride: nextProvider }),
      };
    };
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === sessionId ? applyFields(s) : s)),
    }));
    try {
      await updateSessionConfigInDb(tauriDatabase, sessionId, fields);
    } catch (err) {
      set((state) => ({
        sessions: state.sessions.map((s) => (s.id === sessionId ? prev : s)),
      }));
      throw err;
    }
  };
};
