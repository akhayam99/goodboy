import { eventMatches } from '../../keyboard/dispatcher';
import { SHORTCUTS, TERMINAL_TAB_IDS } from '../../keyboard/registry';
import type { ShortcutId } from '../../keyboard/registry';

type Params = {
  readonly event: KeyboardEvent;
};

const APP_CHORD_IDS: ReadonlyArray<ShortcutId> = [...TERMINAL_TAB_IDS, 'slot.close'];

export const isTerminalAppChord = ({ event }: Params): boolean =>
  event.type === 'keydown' &&
  APP_CHORD_IDS.some((id) => eventMatches({ event, entry: SHORTCUTS[id] }));
