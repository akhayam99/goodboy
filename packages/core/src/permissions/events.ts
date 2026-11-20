import type { IsoDateTime, ProviderRunId, TurnEvent } from '@goodboy/types';

export const createPermissionRequestEvent = (params: {
  readonly runId: ProviderRunId;
  readonly toolUseId: string;
  readonly toolName: string;
  readonly input: unknown;
  readonly at: IsoDateTime;
}): Extract<TurnEvent, { kind: 'permission_request' }> => {
  return {
    kind: 'permission_request',
    runId: params.runId,
    toolUseId: params.toolUseId,
    toolName: params.toolName,
    input: params.input,
    at: params.at,
  };
};
