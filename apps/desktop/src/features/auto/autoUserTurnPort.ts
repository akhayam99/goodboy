import type { AgentId, MessageAttachment, SessionId } from '@goodboy/types';

export type AutoUserTurnQueued = Readonly<{
  rowId: string;
  isRepeat?: boolean;
}>;

export type AutoUserTurnParams = Readonly<{
  agentId: AgentId;
  sessionId: SessionId;
  workspaceId: string;
  text: string;
  images?: ReadonlyArray<MessageAttachment>;
  permissionOnceAllows?: ReadonlyArray<string>;
  deliveryId?: string;
  onQueued?: (queued: AutoUserTurnQueued) => void;
}>;

export type AutoUserTurnResult = 'queued' | 'lost';

export type AutoUserTurnPort = (params: AutoUserTurnParams) => Promise<AutoUserTurnResult>;

type Registry = {
  port: AutoUserTurnPort | null;
};

const registry: Registry = { port: null };

type RegisterParams = {
  readonly port: AutoUserTurnPort | null;
};

export const registerAutoUserTurnPort = ({ port }: RegisterParams): void => {
  registry.port = port;
};

export const currentAutoUserTurnPort = (): AutoUserTurnPort | null => registry.port;
