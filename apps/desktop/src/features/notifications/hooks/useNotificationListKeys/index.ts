import { useEffect, useRef } from 'react';

type Params = {
  readonly keys: ReadonlyArray<string>;
  readonly selectedKey: string | null;
  readonly onSelect: (key: string) => void;
  readonly onDismiss: (key: string) => void;
  readonly onActivate: (key: string) => void;
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

export const useNotificationListKeys = ({
  keys,
  selectedKey,
  onSelect,
  onDismiss,
  onActivate,
}: Params): void => {
  const latest = useRef({ keys, selectedKey, onSelect, onDismiss, onActivate });
  latest.current = { keys, selectedKey, onSelect, onDismiss, onActivate };

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
      if (event.key === 'j' || event.key === 'k') {
        const next =
          event.key === 'j'
            ? current.keys[Math.min(index + 1, current.keys.length - 1)]
            : current.keys[Math.max(index - 1, 0)];
        if (next == null) {
          return;
        }
        event.preventDefault();
        current.onSelect(next);
        return;
      }
      if (current.selectedKey == null || index < 0) {
        return;
      }
      if (event.key === 'e') {
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
