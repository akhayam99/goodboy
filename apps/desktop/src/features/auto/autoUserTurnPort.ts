import type { AgentId, MessageAttachment, SessionId } from '@goodboy/types';

type AutoUserTurnParams = Readonly<{
  agentId: AgentId;
  sessionId: SessionId;
  workspaceId: string;
  text: string;
  images?: ReadonlyArray<MessageAttachment>;
}>;

type AutoUserTurnResult = 'queued' | 'lost';

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
