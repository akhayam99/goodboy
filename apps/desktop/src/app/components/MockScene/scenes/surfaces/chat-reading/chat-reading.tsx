import type { ComponentType } from 'react';
import { ChatReadingScene } from './ChatReadingScene';

export const U31_CHAT_READING_SCENES = {
  'u31-chat-reading': () => <ChatReadingScene />,
} satisfies Readonly<Record<string, ComponentType>>;
