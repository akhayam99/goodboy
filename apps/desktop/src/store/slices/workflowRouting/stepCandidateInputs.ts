import { readHeadroom, type CandidateInputs } from '@goodboy/core/providers';
import { formatError } from '@goodboy/ui';
import type { ProviderId, SessionId, WorkflowRules } from '@goodboy/types';
import { autoRoutableProviders } from '../../../features/providers/autoRoutableProviders';
import { readProviderAgentTurns } from '../../runtime/models/readProviderAgentTurns';
import { selectCandidateInputs } from '../../runtime/models/selectCandidateInputs';
import { sessionById } from '../sessions/sessionIndex';
import type { GetFn } from '../workflows/types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly runProviders: ReadonlyArray<ProviderId> | null | undefined;
  readonly rules?: WorkflowRules | null;
};

type StaleParams = Pick<Params, 'get' | 'sessionId'> & {
  readonly nowMs: number;
};

const hasStaleReading = ({ get, sessionId, nowMs }: StaleParams): boolean => {
  const state = get();
  const workspaceId = sessionById(state.sessions, sessionId)?.workspaceId ?? null;
  const policy =
    workspaceId === null ? null : (state.workspaceOverrides?.[workspaceId]?.providerPool ?? null);
  const connected = autoRoutableProviders({ providers: state.providers ?? [] });
  return readHeadroom({ limits: state.providerLimits ?? {}, policy, nowMs }).stale.some(
    (provider) => connected.includes(provider),
  );
};

export const stepCandidateInputs = async ({
  get,
  sessionId,
  runProviders,
  rules = null,
}: Params): Promise<CandidateInputs> => {
  const nowMs = Date.now();
  const connected = (get().providers ?? []).filter(
    (provider) => provider.connection === 'connected',
  );
  const isChoice = connected.length >= 2;
  const isLoad = rules?.spreadByHeadroom === true;
  if (isChoice && isLoad && hasStaleReading({ get, sessionId, nowMs })) {
    await get()
      .probeProviderLimits()
      .catch((error: unknown) => {
        console.warn(`[routing] provider limits re-read failed: ${formatError(error)}`);
      });
  }
  const turns = isChoice ? await readProviderAgentTurns({ nowMs }) : [];
  const inputs = selectCandidateInputs({ state: get(), sessionId, nowMs: Date.now(), turns });
  return {
    ...inputs,
    rule: isLoad ? 'load' : 'order',
    runProviders: runProviders == null || runProviders.length === 0 ? null : runProviders,
  };
};
