import { readHeadroom, type HeadroomMap } from '@goodboy/core/providers';
import type { SessionId, WorkflowRules, WorkspaceId } from '@goodboy/types';
import { sessionById } from '../sessions/sessionIndex';
import { autoRoutableProviders } from '../../../features/providers/autoRoutableProviders';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly rules: WorkflowRules | null | undefined;
};

type ReadParams = {
  readonly get: GetFn;
  readonly workspaceId: WorkspaceId | null;
};

const readNow = ({ get, workspaceId }: ReadParams) => {
  const state = get();
  const policy =
    workspaceId === null ? null : (state.workspaceOverrides?.[workspaceId]?.providerPool ?? null);
  const connected = autoRoutableProviders({ providers: state.providers ?? [] });
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
  const workspaceId = sessionById(get().sessions, sessionId)?.workspaceId ?? null;
  const first = readNow({ get, workspaceId });
  if (!first.needsReread) {
    return first.headroom;
  }
  await get()
    .probeProviderLimits()
    .catch(() => undefined);
  return readNow({ get, workspaceId }).headroom;
};
