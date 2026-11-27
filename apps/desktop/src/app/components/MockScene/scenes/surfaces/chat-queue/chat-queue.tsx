import type { ComponentType } from 'react';
import { ChatRoomScene } from '../../ChatRoomScene';

export const CHAT_QUEUE_SCENES = {
  'chat-queue': () => <ChatRoomScene chat="release" activity="queued" />,
} satisfies Readonly<Record<string, ComponentType>>;
