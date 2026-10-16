import type { ComponentType } from 'react';
import { AutoChatScene } from './AutoChatScene';
import { AutoOverviewScene } from './AutoOverviewScene';

export const U24_AUTO_CHAT_SCENES: Readonly<Record<string, ComponentType>> = {
  'auto-chat-answering': () => <AutoChatScene state="answering" />,
  'auto-chat-delegating': () => <AutoChatScene state="delegating" />,
  'auto-chat-plan': () => <AutoChatScene state="plan" isPlanOpen />,
  'auto-chat-working': () => <AutoChatScene state="working" />,
  'auto-chat-revising': () => <AutoChatScene state="revising" />,
  'auto-chat-confirm': () => <AutoChatScene state="confirm" />,
  'auto-chat-done': () => <AutoChatScene state="done" />,
  'auto-chat-finished': () => <AutoChatScene state="finished" />,
  'auto-chat-nocap': () => <AutoChatScene state="nocap" />,
  'auto-chat-child': () => <AutoChatScene state="working" selected="planner" />,
  'auto-overview-row': () => <AutoOverviewScene state="working" />,
};
