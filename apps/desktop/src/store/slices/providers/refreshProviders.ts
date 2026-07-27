import {
  buildProviderList,
  checkProviderAuth,
  getCodexStatus,
  getCursorStatus,
  getGeminiStatus,
  getOpenCodeStatus,
  getOpenRouterStatus,
  getProviderStatus,
  type ProviderAuthResults,
  type ProviderStatuses,
} from '../../../features/providers/providers';
import type { GetFn, SetFn } from './types';

export const refreshProviders = (set: SetFn, get: GetFn) => {
  return async () => {
    const [
      providerStatus,
      cursorStatus,
      codexStatus,
      geminiStatus,
      opencodeStatus,
      openrouterStatus,
    ] = await Promise.all([
      getProviderStatus('anthropic'),
      getCursorStatus(),
      getCodexStatus(),
      getGeminiStatus(),
      getOpenCodeStatus(),
      getOpenRouterStatus(),
    ]);
    const statuses: ProviderStatuses = {
      anthropic: providerStatus,
      cursor: cursorStatus,
      codex: codexStatus,
      gemini: geminiStatus,
      opencode: opencodeStatus,
      openrouter: openrouterStatus,
    };
    const [anthropicAuth, cursorAuth, codexAuth, geminiAuth, opencodeAuth, openrouterAuth] =
      await Promise.all([
        checkProviderAuth('anthropic'),
        checkProviderAuth('cursor'),
        checkProviderAuth('codex'),
        checkProviderAuth('gemini'),
        checkProviderAuth('opencode'),
        checkProviderAuth('openrouter'),
      ]);
    const authResults: ProviderAuthResults = {
      anthropic: anthropicAuth,
      cursor: cursorAuth,
      codex: codexAuth,
      gemini: geminiAuth,
      opencode: opencodeAuth,
      openrouter: openrouterAuth,
    };
    const credentialProviderIds = new Set(get().providerCredentials.map((item) => item.providerId));
    set({
      providerStatus,
      cursorStatus,
      codexStatus,
      geminiStatus,
      authResults,
      providers: buildProviderList(statuses, authResults, credentialProviderIds),
    });
  };
};
