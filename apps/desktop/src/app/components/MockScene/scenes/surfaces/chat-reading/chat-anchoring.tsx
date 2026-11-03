import type { ComponentType } from 'react';
import { ChatReadingScene } from './ChatReadingScene';

export const U31_CHAT_ANCHORING_SCENES = {
  'u31-chat-anchoring': () => <ChatReadingScene isSent />,
} satisfies Readonly<Record<string, ComponentType>>;
