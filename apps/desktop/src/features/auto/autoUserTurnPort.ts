import type { AgentId, MessageAttachment, SessionId } from '@goodboy/types';
import { createPort } from './createPort';

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

const slot = createPort<AutoUserTurnPort>();

export const registerAutoUserTurnPort = slot.register;

export const currentAutoUserTurnPort = slot.current;
