import {
  checkProviderAuth,
  refreshProviderDetection,
  type ProviderStatus,
  type AuthState,
} from '../../../features/providers/providers';
import { cursorMaxModeAdvisory } from '../../../shared/lib/cursorMaxModeAdvisory';
import { applyProviderProbe, takeProbeSeq } from './applyProviderProbe';
import { SIGNED_OUT_CONFIRM_MS, hasPendingSignedOut } from './providerHealth';
import { probeLock } from './probeLock';
import type { ProviderId } from '@goodboy/types';
import type { GetFn, SetFn } from './types';

export type RefreshProvidersParams = {
  readonly isFresh?: boolean;
};

const RECHECK_DELAY_MS = SIGNED_OUT_CONFIRM_MS + 2_000;

let current: Promise<void> | null = null;
let isRerunQueued = false;
let recheckTimer: ReturnType<typeof setTimeout> | null = null;

type ProbeParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly isFresh: boolean;
};

type StoredParams = { readonly get: GetFn; readonly providerId: ProviderId };

const storedStatus = ({ get, providerId }: StoredParams): ProviderStatus | null => {
  const provider = get().providers.find((item) => item.id === providerId);
  if (provider === undefined) {
    return null;
  }
  return {
    id: providerId,
    binary: provider.binary,
    available: provider.version !== null && provider.version !== undefined,
    version: provider.version ?? null,
    error: provider.error,
  };
};

const probeAll = async ({ set, get, isFresh }: ProbeParams): Promise<void> => {
  const seq = takeProbeSeq();
  const previousAuthResults = get().authResults;
  const previousCursorIdentity = previousAuthResults?.cursor?.identity ?? null;
  const previousCursorState = previousAuthResults?.cursor?.state ?? null;
  const statuses: Record<ProviderId, ProviderStatus | null> = {
    anthropic: get().providerStatus,
    cursor: get().cursorStatus,
    codex: get().codexStatus,
    gemini: get().geminiStatus,
    opencode: storedStatus({ get, providerId: 'opencode' }),
    openrouter: storedStatus({ get, providerId: 'openrouter' }),
    moonshot: storedStatus({ get, providerId: 'moonshot' }),
  };
  const authResults: Partial<Record<ProviderId, AuthState | null>> = { ...previousAuthResults };
  const only: ProviderId[] = [];
  const ids: ReadonlyArray<ProviderId> = ['anthropic', 'cursor', 'codex', 'gemini', 'opencode'];
  await Promise.all(
    ids.map((id) =>
      probeLock({
        get,
        providerId: id,
        kind: 'status',
        isAutomatic: !isFresh,
        run: async () => {
          const status = await refreshProviderDetection({ id });
          statuses[id] = status;
          authResults[id] = await checkProviderAuth(id);
          only.push(id);
          if (id === 'opencode') {
            for (const apiId of ['openrouter', 'moonshot'] satisfies ReadonlyArray<ProviderId>) {
              statuses[apiId] = { ...status, id: apiId };
              authResults[apiId] = await checkProviderAuth(apiId);
              only.push(apiId);
            }
          }
        },
      }),
    ),
  );
  const {
    anthropic: providerStatus,
    cursor: cursorStatus,
    codex: codexStatus,
    gemini: geminiStatus,
  } = statuses;
  const cursorAuth = authResults.cursor;
  const isApplied = applyProviderProbe({
    set,
    get,
    seq,
    statuses,
    authResults,
    only,
    patch: { providerStatus, cursorStatus, codexStatus, geminiStatus },
  });
  if (!isApplied) {
    return;
  }
  if (
    cursorAuth !== null &&
    cursorAuth !== undefined &&
    previousAuthResults !== null &&
    previousAuthResults !== undefined &&
    (previousCursorIdentity !== cursorAuth.identity ||
      (cursorAuth.state === 'connected' && previousCursorState !== 'connected'))
  ) {
    cursorMaxModeAdvisory.clearAll({});
  }
};

type Params = { readonly set: SetFn; readonly get: GetFn };

export const refreshProviders = ({ set, get }: Params) => {
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
        const shouldForce = isFresh || isRerunQueued;
        isRerunQueued = false;
        await probeAll({ set, get, isFresh: shouldForce });
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
