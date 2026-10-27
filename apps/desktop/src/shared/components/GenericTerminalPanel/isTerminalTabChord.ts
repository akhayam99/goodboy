import { eventMatches } from '../../keyboard/dispatcher';
import { SHORTCUTS, TERMINAL_TAB_IDS } from '../../keyboard/registry';

type Params = {
  readonly event: KeyboardEvent;
};

export const isTerminalTabChord = ({ event }: Params): boolean =>
  event.type === 'keydown' &&
  TERMINAL_TAB_IDS.some((id) => eventMatches({ event, entry: SHORTCUTS[id] }));
