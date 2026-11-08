import type { AgentId, SessionId } from '@goodboy/types';
import { createPort } from './createPort';

export type AutoChildTurnParams = Readonly<{
  agentId: AgentId;
  sessionId: SessionId;
  text: string;
  from: 'user' | 'auto-message';
  hasFiles: boolean;
}>;

export type AutoChildTurnResult =
  | Readonly<{ kind: 'continued' }>
  | Readonly<{ kind: 'working' }>
  | Readonly<{ kind: 'plain' }>
  | Readonly<{ kind: 'refused'; message: string }>;

export type AutoChildTurnPort = (params: AutoChildTurnParams) => Promise<AutoChildTurnResult>;

const slot = createPort<AutoChildTurnPort>();

export const registerAutoChildTurnPort = slot.register;

export const currentAutoChildTurnPort = slot.current;
