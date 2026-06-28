import {
  buildProviderList,
  checkProviderAuth,
  getCodexStatus,
  getCursorStatus,
  getGeminiStatus,
  getOpenCodeStatus,
  getProviderStatus,
  type ProviderAuthResults,
  type ProviderStatuses,
} from '../../../features/providers/providers';
import type { SetFn } from './types';

export const refreshProviders = (set: SetFn) => {
  return async () => {
    const [providerStatus, cursorStatus, codexStatus, geminiStatus, openCodeStatus] =
      await Promise.all([
        getProviderStatus('anthropic'),
        getCursorStatus(),
        getCodexStatus(),
        getGeminiStatus(),
        getOpenCodeStatus(),
      ]);
    const statuses: ProviderStatuses = {
      anthropic: providerStatus,
      cursor: cursorStatus,
      codex: codexStatus,
      gemini: geminiStatus,
      opencode: openCodeStatus,
    };
    const [anthropicAuth, cursorAuth, codexAuth, geminiAuth, openCodeAuth] = await Promise.all([
      checkProviderAuth('anthropic'),
      checkProviderAuth('cursor'),
      checkProviderAuth('codex'),
      checkProviderAuth('gemini'),
      checkProviderAuth('opencode'),
    ]);
    const authResults: ProviderAuthResults = {
      anthropic: anthropicAuth,
      cursor: cursorAuth,
      codex: codexAuth,
      gemini: geminiAuth,
      opencode: openCodeAuth,
    };
    set({
      providerStatus,
      cursorStatus,
      codexStatus,
      geminiStatus,
      openCodeStatus,
      authResults,
      providers: buildProviderList(statuses, authResults),
    });
  };
};
