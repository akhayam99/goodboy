import { eventMatches } from '../../keyboard/dispatcher';
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

export type ListKeyId = (typeof LIST_KEY_IDS)[number];

const CHARACTER_ALIASES: Readonly<Partial<Record<ListKeyId, ReadonlySet<string>>>> = {
  'list.next': new Set(['ArrowDown']),
  'list.previous': new Set(['ArrowUp']),
  'list.open': new Set(['Enter']),
  'list.search': new Set(['/']),
};

type Params = {
  readonly event: KeyboardEvent;
};

export const matchedListKey = ({ event }: Params): ListKeyId | null =>
  LIST_KEY_IDS.find(
    (id) =>
      eventMatches({ event, entry: SHORTCUTS[id] }) ||
      CHARACTER_ALIASES[id]?.has(event.key) === true,
  ) ?? null;
