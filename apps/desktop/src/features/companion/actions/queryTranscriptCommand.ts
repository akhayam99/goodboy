import { useAppStore } from '../../../store/store';
import { asString } from '../asString';
import { BridgeSafeError } from '../bridgeSafeError';
import { transcriptOf } from './transcriptOf';

type Params = {
  readonly data: Record<string, unknown>;
};

export const queryTranscriptCommand = async ({ data }: Params) => {
  const workspaceId = asString({ value: data.workspaceId });
  const sessionId = asString({ value: data.sessionId });
  const agentId = asString({ value: data.agentId });
  if (workspaceId === undefined || sessionId === undefined || agentId === undefined) {
    throw new BridgeSafeError('queryTranscript requires workspaceId, sessionId and agentId');
  }
  const projection = await transcriptOf({
    query: {
      workspaceId,
      sessionId,
      agentId,
      limit: typeof data.limit === 'number' ? data.limit : 100,
      beforeEntryId: asString({ value: data.beforeEntryId }) ?? null,
    },
    getStore: () => useAppStore.getState(),
  });
  if (projection === null) {
    throw new BridgeSafeError('unknown agent for session');
  }
  return projection;
};
