import type { SessionId, WorkspaceId } from '@goodboy/types';
import type { PinDirection } from './pinsChanges';
import type { SessionPinsState } from './state';

export type { SetFn, GetFn } from '../../slice-types';

type LoadSessionPinsParams = {
  readonly workspaceId: WorkspaceId;
};

type MoveSessionPinParams = {
  readonly sessionId: SessionId;
  readonly direction: PinDirection;
};

export type SessionPinsSlice = SessionPinsState & {
  loadSessionPins(params: LoadSessionPinsParams): Promise<void>;
  pinSession(sessionId: SessionId): Promise<void>;
  unpinSession(sessionId: SessionId): Promise<void>;
  moveSessionPin(params: MoveSessionPinParams): Promise<void>;
};
