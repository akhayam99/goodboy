import type { Session, SessionId } from '@goodboy/types'
import { updateSessionConfig as updateSessionConfigInDb } from '@goodboy/db'
import type { SessionConfigUpdate } from '@goodboy/db'
import { tauriDatabase } from '../../../shared/lib/db'
import type { GetFn, SetFn } from './types'

export const setSessionConfig = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, fields: SessionConfigUpdate) => {
    const prev = get().sessions.find((s) => s.id === sessionId)
    if (!prev) {
      return
    }
    const applyFields = (s: Session): Session => {
      const { verbosity, effort, modelOverride, providerOverride, ...rest } = s
      const next: Session = { ...rest } as Session
      const nextVerbosity = fields.verbosity !== undefined ? fields.verbosity : (verbosity ?? null)
      const nextEffort = fields.effort !== undefined ? fields.effort : (effort ?? null)
      const nextModel =
        fields.modelOverride !== undefined ? fields.modelOverride : (modelOverride ?? null)
      const nextProvider =
        fields.defaultProvider !== undefined && fields.defaultProvider !== null
          ? null
          : fields.providerOverride !== undefined
            ? fields.providerOverride
            : (providerOverride ?? null)
      let nextPreference = s.providerPreference
      if (fields.defaultProvider !== undefined && fields.defaultProvider !== null) {
        nextPreference = { ...nextPreference, defaultProvider: fields.defaultProvider }
      }
      if (fields.enabledProviders !== undefined) {
        const enabled = fields.enabledProviders
        nextPreference = {
          defaultProvider: nextPreference.defaultProvider,
          allowTurnOverride: nextPreference.allowTurnOverride,
          ...(nextPreference.defaultModel !== undefined && {
            defaultModel: nextPreference.defaultModel,
          }),
          ...(enabled !== null && enabled.length > 0 && { enabledProviders: enabled }),
        }
      }
      return {
        ...next,
        providerPreference: nextPreference,
        ...(nextVerbosity != null && { verbosity: nextVerbosity }),
        ...(nextEffort != null && { effort: nextEffort }),
        ...(nextModel != null && { modelOverride: nextModel }),
        ...(nextProvider != null && { providerOverride: nextProvider }),
      }
    }
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === sessionId ? applyFields(s) : s)),
    }))
    try {
      await updateSessionConfigInDb(tauriDatabase, sessionId, fields)
    } catch (err) {
      set((state) => ({
        sessions: state.sessions.map((s) => (s.id === sessionId ? prev : s)),
      }))
      throw err
    }
  }
}
