import { useEffect, type RefObject } from 'react';
import { appScrollIntoView } from '@goodboy/ui';
import { RELEASE_FOLLOW_EVENT } from '../../ChatView/useScrollPin';

const GIVE_UP_MS = 2000;

type Params = {
  readonly bodyRef: RefObject<HTMLElement | null>;
  readonly toolUseId: string | null;
  readonly request: object | null;
};

export const useRevealToolCall = ({ bodyRef, toolUseId, request }: Params): void => {
  useEffect(() => {
    const body = bodyRef.current;
    if (toolUseId === null || body === null) {
      return;
    }
    const reveal = (): boolean => {
      const row = body.querySelector(`[data-tool-use-ids~="${CSS.escape(toolUseId)}"]`);
      if (row === null) {
        return false;
      }
      row.dispatchEvent(new Event(RELEASE_FOLLOW_EVENT, { bubbles: true }));
      appScrollIntoView({ element: row, behavior: 'smooth', block: 'center' });
      return true;
    };
    if (reveal()) {
      return;
    }
    const observer = new MutationObserver(() => {
      if (reveal()) {
        observer.disconnect();
      }
    });
    observer.observe(body, { childList: true, subtree: true });
    const giveUp = setTimeout(() => observer.disconnect(), GIVE_UP_MS);
    return () => {
      clearTimeout(giveUp);
      observer.disconnect();
    };
  }, [bodyRef, toolUseId, request]);
};
