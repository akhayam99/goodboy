import { useEffect } from 'react';
import { WORKSPACE_ID } from '../BoardScene';
import { ChatRoomScene } from '../ChatRoomScene';

type Props = {
  readonly isSelecting: boolean;
};

const PICKED_KEYS = ['rounding', 'webhook'];

const POLL_MS = 100;

const POLL_LIMIT = 40;

type PickParams = {
  readonly key: string;
};

const boxOf = ({ key }: PickParams): HTMLElement | null =>
  document.querySelector<HTMLElement>(
    `[data-chat-row="mock-chat-${WORKSPACE_ID}-${key}"] [data-selection-checkbox]`,
  );

export const R4ChatListScene = ({ isSelecting }: Props) => {
  useEffect(() => {
    if (!isSelecting) {
      return undefined;
    }
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      const boxes = PICKED_KEYS.map((key) => boxOf({ key }));
      if (boxes.every((box) => box !== null)) {
        window.clearInterval(timer);
        boxes.forEach((box) => box?.click());
        return;
      }
      if (tries >= POLL_LIMIT) {
        window.clearInterval(timer);
      }
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [isSelecting]);
  return <ChatRoomScene activity="mixed" />;
};
