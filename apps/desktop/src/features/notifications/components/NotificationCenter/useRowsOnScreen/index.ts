import { useEffect, useState, type RefObject } from 'react';

const ROW_SELECTOR = '[data-notification-key]';
const MOSTLY_VISIBLE = 0.6;

type Params = {
  readonly rootRef: RefObject<HTMLElement | null>;
  readonly isActive: boolean;
  readonly keys: ReadonlyArray<string>;
};

type OnScreen = {
  readonly isEverything: boolean;
  readonly keys: ReadonlySet<string>;
};

const NOTHING: OnScreen = { isEverything: false, keys: new Set() };

export const useRowsOnScreen = ({ rootRef, isActive, keys }: Params): OnScreen => {
  const [onScreen, setOnScreen] = useState<OnScreen>(NOTHING);
  const keysKey = keys.join('\n');

  useEffect(() => {
    const root = rootRef.current;
    if (!isActive || root === null) {
      setOnScreen(NOTHING);
      return;
    }
    if (typeof IntersectionObserver === 'undefined') {
      setOnScreen({ isEverything: true, keys: new Set(keysKey === '' ? [] : keysKey.split('\n')) });
      return;
    }
    setOnScreen(NOTHING);
    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const key = entry.target.getAttribute('data-notification-key');
          if (key === null) {
            continue;
          }
          if (entry.isIntersecting) {
            visible.add(key);
            continue;
          }
          visible.delete(key);
        }
        setOnScreen({ isEverything: false, keys: new Set(visible) });
      },
      { root, threshold: MOSTLY_VISIBLE },
    );
    for (const row of root.querySelectorAll(ROW_SELECTOR)) {
      observer.observe(row);
    }
    return () => {
      observer.disconnect();
    };
  }, [rootRef, isActive, keysKey]);

  return onScreen;
};
