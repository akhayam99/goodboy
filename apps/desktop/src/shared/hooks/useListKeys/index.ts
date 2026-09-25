import { useEffect, useRef } from 'react';

type Params = {
  readonly keys: ReadonlyArray<string>;
  readonly selectedKey: string | null;
  readonly onSelect: (key: string) => void;
  readonly onActivate: (key: string) => void;
  readonly onDismiss?: (key: string) => void;
  readonly extraKeys?: Readonly<Record<string, (selectedKey: string | null) => void>>;
};

type TypingTargetParams = {
  readonly target: EventTarget | null;
};

const isTypingTarget = ({ target }: TypingTargetParams): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  );
};

const NEXT_KEYS: ReadonlySet<string> = new Set(['j', 'ArrowDown']);
const PREVIOUS_KEYS: ReadonlySet<string> = new Set(['k', 'ArrowUp']);

export const useListKeys = ({
  keys,
  selectedKey,
  onSelect,
  onActivate,
  onDismiss,
  extraKeys,
}: Params): void => {
  const latest = useRef({ keys, selectedKey, onSelect, onActivate, onDismiss, extraKeys });
  latest.current = { keys, selectedKey, onSelect, onActivate, onDismiss, extraKeys };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) {
        return;
      }
      if (isTypingTarget({ target: event.target })) {
        return;
      }
      const current = latest.current;
      const index = current.selectedKey == null ? -1 : current.keys.indexOf(current.selectedKey);
      const isNext = NEXT_KEYS.has(event.key);
      if (isNext || PREVIOUS_KEYS.has(event.key)) {
        const next = isNext
          ? current.keys[Math.min(index + 1, current.keys.length - 1)]
          : current.keys[Math.max(index - 1, 0)];
        if (next == null) {
          return;
        }
        event.preventDefault();
        current.onSelect(next);
        return;
      }
      const extra = current.extraKeys?.[event.key];
      if (extra != null) {
        event.preventDefault();
        extra(index < 0 ? null : current.selectedKey);
        return;
      }
      if (current.selectedKey == null || index < 0) {
        return;
      }
      if (event.key === 'e' && current.onDismiss != null) {
        event.preventDefault();
        current.onDismiss(current.selectedKey);
        return;
      }
      if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) {
        event.preventDefault();
        current.onActivate(current.selectedKey);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
};
