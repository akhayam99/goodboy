import { useEffect, useRef } from 'react';
import { eventMatches, plainKeyYields } from '../../keyboard/dispatcher';
import { SHORTCUTS, type ShortcutId } from '../../keyboard/registry';

const LIST_KEY_IDS = [
  'list.next',
  'list.previous',
  'list.open',
  'list.openInTool',
  'list.reply',
  'list.star',
  'list.dismiss',
  'list.search',
] as const satisfies ReadonlyArray<ShortcutId>;

type ListKeyId = (typeof LIST_KEY_IDS)[number];

const CHARACTER_ALIASES: Readonly<Partial<Record<ListKeyId, ReadonlySet<string>>>> = {
  'list.next': new Set(['ArrowDown']),
  'list.previous': new Set(['ArrowUp']),
  'list.open': new Set(['Enter']),
  'list.search': new Set(['/']),
};

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
};

type MatchParams = {
  readonly event: KeyboardEvent;
};

const isOtherButton = (target: EventTarget | null): boolean =>
  target instanceof HTMLButtonElement && target.getAttribute('role') !== 'option';

const matchedListKey = ({ event }: MatchParams): ListKeyId | null =>
  LIST_KEY_IDS.find(
    (id) =>
      eventMatches({ event, entry: SHORTCUTS[id] }) ||
      CHARACTER_ALIASES[id]?.has(event.key) === true,
  ) ?? null;

export const useListKeys = (params: Params): void => {
  const latest = useRef(params);
  latest.current = params;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || plainKeyYields(event)) {
        return;
      }
      const id = matchedListKey({ event });
      if (id === null) {
        return;
      }
      const current = latest.current;
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
