import {
  checkProviderAuth,
  refreshProviderDetection,
  type ProviderAuthResults,
  type ProviderStatuses,
} from '../../../features/providers/providers';
import { cursorMaxModeAdvisory } from '../../../shared/lib/cursorMaxModeAdvisory';
import { applyProviderProbe, takeProbeSeq } from './applyProviderProbe';
import { SIGNED_OUT_CONFIRM_MS, hasPendingSignedOut } from './providerHealth';
import type { GetFn, SetFn } from './types';

export type RefreshProvidersParams = {
  readonly isFresh?: boolean;
};

const RECHECK_DELAY_MS = SIGNED_OUT_CONFIRM_MS + 2_000;

let current: Promise<void> | null = null;
let isRerunQueued = false;
let recheckTimer: ReturnType<typeof setTimeout> | null = null;

const probeAll = async (set: SetFn, get: GetFn): Promise<void> => {
  const seq = takeProbeSeq();
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
  const statuses: ProviderStatuses = {
    anthropic: providerStatus,
    cursor: cursorStatus,
    codex: codexStatus,
    gemini: geminiStatus,
    opencode: opencodeStatus,
    openrouter: { ...opencodeStatus, id: 'openrouter' },
    moonshot: { ...opencodeStatus, id: 'moonshot' },
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
  const isApplied = applyProviderProbe({
    set,
    get,
    seq,
    statuses,
    authResults,
    patch: { providerStatus, cursorStatus, codexStatus, geminiStatus },
  });
  if (!isApplied) {
    return;
  }
  if (
    previousAuthResults !== null &&
    previousAuthResults !== undefined &&
    (previousCursorIdentity !== cursorAuth.identity ||
      (cursorAuth.state === 'connected' && previousCursorState !== 'connected'))
  ) {
    cursorMaxModeAdvisory.clearAll({});
  }
};

export const refreshProviders = (set: SetFn, get: GetFn) => {
  const refresh = ({ isFresh = false }: RefreshProvidersParams = {}): Promise<void> => {
    if (current !== null) {
      if (isFresh) {
        isRerunQueued = true;
      }
      return current;
    }
    if (recheckTimer !== null) {
      clearTimeout(recheckTimer);
      recheckTimer = null;
    }
    current = (async () => {
      do {
        isRerunQueued = false;
        await probeAll(set, get);
      } while (isRerunQueued);
      if (recheckTimer === null && hasPendingSignedOut({ map: get().providerHealth })) {
        recheckTimer = setTimeout(() => {
          recheckTimer = null;
          void refresh().catch(() => undefined);
        }, RECHECK_DELAY_MS);
      }
    })().finally(() => {
      current = null;
      isRerunQueued = false;
    });
    return current;
  };
  return refresh;
};
