import type { AgentId, ProviderRunId, SessionId } from '@goodboy/types';

export type UndeliveredPermission = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly toolUseId: string;
  readonly toolName: string;
  readonly input: unknown;
  readonly runId: ProviderRunId;
  readonly verdict: 'allow' | 'deny';
};

const undelivered = new Map<string, UndeliveredPermission>();

type KeyParams = {
  readonly toolUseId: string;
};

type SaveParams = {
  readonly pending: UndeliveredPermission;
};

export const saveUndelivered = ({ pending }: SaveParams): void => {
  undelivered.set(pending.toolUseId, pending);
};

export const undeliveredOf = ({ toolUseId }: KeyParams): UndeliveredPermission | null =>
  undelivered.get(toolUseId) ?? null;

export const dropUndelivered = ({ toolUseId }: KeyParams): void => {
  undelivered.delete(toolUseId);
};

export const clearUndelivered = (): void => {
  undelivered.clear();
};
