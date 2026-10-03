import { readHeadroom, type HeadroomMap } from '@goodboy/core';
import type { SessionId, WorkflowRules } from '@goodboy/types';
import { sessionById } from '../sessions/sessionIndex';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly rules: WorkflowRules | null | undefined;
};

const readNow = ({ get, sessionId }: Pick<Params, 'get' | 'sessionId'>) => {
  const state = get();
  const workspaceId =
    sessionById(state.sessions, sessionId)?.workspaceId ?? state.currentWorkspaceId;
  const policy =
    workspaceId === null ? null : (state.workspaceOverrides?.[workspaceId]?.providerPool ?? null);
  const connected = (state.providers ?? [])
    .filter((provider) => provider.connection === 'connected')
    .map((provider) => provider.id);
  const reading = readHeadroom({ limits: state.providerLimits ?? {}, policy, nowMs: Date.now() });
  return {
    headroom: reading.headroom,
    needsReread: reading.stale.some((provider) => connected.includes(provider)),
  };
};

export const resolveWorkflowHeadroom = async ({
  get,
  sessionId,
  rules,
}: Params): Promise<HeadroomMap | null> => {
  if (rules?.spreadByHeadroom !== true) {
    return null;
  }
  const first = readNow({ get, sessionId });
  if (!first.needsReread) {
    return first.headroom;
  }
  await get()
    .probeProviderLimits()
    .catch(() => undefined);
  return readNow({ get, sessionId }).headroom;
};
