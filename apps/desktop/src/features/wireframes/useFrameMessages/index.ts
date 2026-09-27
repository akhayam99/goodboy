import { useEffect, useRef, type RefObject } from 'react';
import { parseFrameMessage, type FrameMessage } from '../frame/frameMessage';

type Params = {
  readonly frameRef: RefObject<HTMLIFrameElement | null>;
  readonly onMessage: (message: FrameMessage) => void;
};

export const useFrameMessages = ({ frameRef, onMessage }: Params): void => {
  const handler = useRef(onMessage);
  handler.current = onMessage;

  useEffect(() => {
    const listen = (event: MessageEvent) => {
      const source = frameRef.current?.contentWindow ?? null;
      if (source === null || event.source !== source) {
        return;
      }
      const message = parseFrameMessage({ data: event.data });
      if (message === null) {
        return;
      }
      handler.current(message);
    };
    window.addEventListener('message', listen);
    return () => window.removeEventListener('message', listen);
  }, [frameRef]);
};
