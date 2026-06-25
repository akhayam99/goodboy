import {
  buildProviderList,
  type ProviderStatus,
  type ProviderStatuses,
} from '../../../features/providers/providers'
import type { SetFn } from './types'

export const refreshProviderStatus = (set: SetFn) => {
  return (status: ProviderStatus) => {
    set((state) => {
      const statuses: ProviderStatuses = {
        anthropic: status,
        cursor: state.cursorStatus,
        codex: state.codexStatus,
        gemini: state.geminiStatus,
      }
      return {
        providerStatus: status,
        providers: buildProviderList(statuses, state.authResults ?? undefined),
      }
    })
  }
}
