import { useIsDrawerParked } from '@goodboy/ui';
import { useEffect, useRef } from 'react';
import { plainKeyYields } from '../../keyboard/dispatcher';
import { matchedListKey, type ListKeyId } from './matchedListKey';
import { handleRowFocusKey, type RowsParams } from './rowFocusKey';

type KeyHandler = (selectedKey: string | null) => void;

type Params = {
  readonly keys: ReadonlyArray<string>;
  readonly selectedKey: string | null;
  readonly onSelect: (key: string) => void;
  readonly onActivate: (key: string) => void;
  readonly onDismiss?: (key: string) => void;
  readonly onOpenInTool?: KeyHandler;
  readonly onReply?: KeyHandler;
  readonly onStar?: KeyHandler;
  readonly onSearch?: KeyHandler;
  readonly rows?: RowsParams;
};

const isOtherButton = (target: EventTarget | null): boolean =>
  target instanceof HTMLButtonElement && target.getAttribute('role') !== 'option';

export const useListKeys = (params: Params): void => {
  const latest = useRef(params);
  latest.current = params;
  const isParked = useIsDrawerParked();
  const isParkedRef = useRef(isParked);
  isParkedRef.current = isParked;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isParkedRef.current) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey || plainKeyYields(event)) {
        return;
      }
      const id = matchedListKey({ event });
      if (id === null) {
        return;
      }
      const current = latest.current;
      if (current.rows !== undefined) {
        const { onSearch } = current;
        handleRowFocusKey({
          event,
          id,
          rows: current.rows,
          onSearch: onSearch === undefined ? undefined : () => onSearch(null),
        });
        return;
      }
      const index = current.selectedKey == null ? -1 : current.keys.indexOf(current.selectedKey);
      const selected = index < 0 ? null : current.selectedKey;

      if (id === 'list.next' || id === 'list.previous') {
        const next =
          id === 'list.next'
            ? current.keys[Math.min(index + 1, current.keys.length - 1)]
            : current.keys[Math.max(index - 1, 0)];
        if (next == null) {
          return;
        }
        event.preventDefault();
        current.onSelect(next);
        return;
      }

      const keyHandlers: Partial<Record<ListKeyId, KeyHandler | undefined>> = {
        'list.openInTool': current.onOpenInTool,
        'list.reply': current.onReply,
        'list.star': current.onStar,
        'list.search': current.onSearch,
      };
      const handler = keyHandlers[id];
      if (handler != null) {
        event.preventDefault();
        handler(selected);
        return;
      }

      if (selected === null) {
        return;
      }
      if (id === 'list.dismiss' && current.onDismiss != null) {
        event.preventDefault();
        current.onDismiss(selected);
        return;
      }
      if (id === 'list.open' && !isOtherButton(event.target)) {
        event.preventDefault();
        current.onActivate(selected);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
};
