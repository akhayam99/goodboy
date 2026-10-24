import { useEffect, useRef, useState } from 'react';

const SEEN_AFTER_MS = 1_000;

const isDocumentVisible = (): boolean => document.visibilityState !== 'hidden';

type SeenParams = {
  readonly id: string;
};

type Params = {
  readonly isOpen: boolean;
  readonly ids: ReadonlyArray<string>;
  readonly onSeen: (params: SeenParams) => void;
};

export const useSeenNotifications = ({ isOpen, ids, onSeen }: Params): void => {
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const onSeenRef = useRef(onSeen);
  const idsKey = ids.join('\n');
  const [isVisible, setIsVisible] = useState(isDocumentVisible);

  useEffect(() => {
    const sync = () => {
      setIsVisible(isDocumentVisible());
    };
    document.addEventListener('visibilitychange', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);

  useEffect(() => {
    onSeenRef.current = onSeen;
  }, [onSeen]);

  useEffect(() => {
    const pending = timers.current;
    const wanted = new Set(isOpen && isVisible && idsKey !== '' ? idsKey.split('\n') : []);
    for (const [id, timer] of pending) {
      if (!wanted.has(id)) {
        clearTimeout(timer);
        pending.delete(id);
      }
    }
    for (const id of wanted) {
      if (pending.has(id)) {
        continue;
      }
      pending.set(
        id,
        setTimeout(() => {
          onSeenRef.current({ id });
        }, SEEN_AFTER_MS),
      );
    }
  }, [idsKey, isOpen, isVisible]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) {
        clearTimeout(timer);
      }
      pending.clear();
    };
  }, []);
};
