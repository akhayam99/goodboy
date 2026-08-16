import {
  buildProviderList,
  checkProviderAuth,
  refreshProviderDetection,
  type ProviderAuthResults,
  type ProviderStatuses,
} from '../../../features/providers/providers';
import { cursorMaxModeAdvisory } from '../../../shared/lib/cursorMaxModeAdvisory';
import { clearStaleConnect } from './clearStaleConnect';
import type { GetFn, SetFn } from './types';

export const refreshProviders = (set: SetFn, get: GetFn) => {
  return async () => {
    const previousAuthResults = get().authResults;
    const previousCursorIdentity = previousAuthResults?.cursor?.identity ?? null;
    const previousCursorState = previousAuthResults?.cursor?.state ?? null;
    const [providerStatus, cursorStatus, codexStatus, geminiStatus, opencodeStatus] =
      await Promise.all([
        refreshProviderDetection({ id: 'anthropic' }),
        refreshProviderDetection({ id: 'cursor' }),
        refreshProviderDetection({ id: 'codex' }),
        refreshProviderDetection({ id: 'gemini' }),
        refreshProviderDetection({ id: 'opencode' }),
      ]);
    const openrouterStatus = { ...opencodeStatus, id: 'openrouter' };
    const moonshotStatus = { ...opencodeStatus, id: 'moonshot' };
    const statuses: ProviderStatuses = {
      anthropic: providerStatus,
      cursor: cursorStatus,
      codex: codexStatus,
      gemini: geminiStatus,
      opencode: opencodeStatus,
      openrouter: openrouterStatus,
      moonshot: moonshotStatus,
    };
    const [
      anthropicAuth,
      cursorAuth,
      codexAuth,
      geminiAuth,
      opencodeAuth,
      openrouterAuth,
      moonshotAuth,
    ] = await Promise.all([
      checkProviderAuth('anthropic'),
      checkProviderAuth('cursor'),
      checkProviderAuth('codex'),
      checkProviderAuth('gemini'),
      checkProviderAuth('opencode'),
      checkProviderAuth('openrouter'),
      checkProviderAuth('moonshot'),
    ]);
    const authResults: ProviderAuthResults = {
      anthropic: anthropicAuth,
      cursor: cursorAuth,
      codex: codexAuth,
      gemini: geminiAuth,
      opencode: opencodeAuth,
      openrouter: openrouterAuth,
      moonshot: moonshotAuth,
    };
    if (
      previousAuthResults !== null &&
      previousAuthResults !== undefined &&
      (previousCursorIdentity !== cursorAuth.identity ||
        (cursorAuth.state === 'connected' && previousCursorState !== 'connected'))
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
      providerConnect: clearStaleConnect({ connect: get().providerConnect, authResults }),
    });
  };
};
