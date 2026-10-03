import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import {
  selectChatOriginsBySession,
  type ChatOrigin,
} from '../../../store/slices/chats/selectChatOrigins';

type Params = {
  readonly sessionId: SessionId;
};

const NO_ORIGINS: ReadonlyArray<ChatOrigin> = [];

export const useChatOrigins = ({ sessionId }: Params): ReadonlyArray<ChatOrigin> =>
  useAppStore((state) => selectChatOriginsBySession(state).get(sessionId) ?? NO_ORIGINS);
