import {
  buildProviderList,
  checkProviderAuth,
  refreshProviderDetection,
  type ProviderAuthResults,
  type ProviderStatuses,
} from '../../../features/providers/providers';
import { cursorMaxModeAdvisory } from '../../../shared/lib/cursorMaxModeAdvisory';
import type { GetFn, SetFn } from './types';

export const refreshProviders = (set: SetFn, get: GetFn) => {
  return async () => {
    const previousCursorIdentity = get().authResults?.cursor?.identity ?? null;
    const previousCursorState = get().authResults?.cursor?.state ?? null;
    const [
      providerStatus,
      cursorStatus,
      codexStatus,
      geminiStatus,
      opencodeStatus,
      openrouterStatus,
    ] = await Promise.all([
      refreshProviderDetection({ id: 'anthropic' }),
      refreshProviderDetection({ id: 'cursor' }),
      refreshProviderDetection({ id: 'codex' }),
      refreshProviderDetection({ id: 'gemini' }),
      refreshProviderDetection({ id: 'opencode' }),
      refreshProviderDetection({ id: 'openrouter' }),
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
    if (
      previousCursorIdentity !== cursorAuth.identity ||
      (cursorAuth.state === 'connected' && previousCursorState !== 'connected')
    ) {
      cursorMaxModeAdvisory.clearAll({});
    }
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
