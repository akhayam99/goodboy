import {
  buildProviderList,
  checkProviderAuth,
  getCodexStatus,
  getCursorStatus,
  getGeminiStatus,
  getProviderStatus,
  type ProviderAuthResults,
  type ProviderStatuses,
} from '../../../features/providers/providers'
import type { SetFn } from './types'

export const refreshProviders = (set: SetFn) => {
  return async () => {
    const [providerStatus, cursorStatus, codexStatus, geminiStatus] = await Promise.all([
      getProviderStatus('anthropic'),
      getCursorStatus(),
      getCodexStatus(),
      getGeminiStatus(),
    ])
    const statuses: ProviderStatuses = {
      anthropic: providerStatus,
      cursor: cursorStatus,
      codex: codexStatus,
      gemini: geminiStatus,
    }
    const [anthropicAuth, cursorAuth, codexAuth, geminiAuth] = await Promise.all([
      checkProviderAuth('anthropic'),
      checkProviderAuth('cursor'),
      checkProviderAuth('codex'),
      checkProviderAuth('gemini'),
    ])
    const authResults: ProviderAuthResults = {
      anthropic: anthropicAuth,
      cursor: cursorAuth,
      codex: codexAuth,
      gemini: geminiAuth,
    }
    set({
      providerStatus,
      cursorStatus,
      codexStatus,
      geminiStatus,
      authResults,
      providers: buildProviderList(statuses, authResults),
    })
  }
}
