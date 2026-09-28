import { eventMatches } from '../../keyboard/dispatcher';
import { SHORTCUTS } from '../../keyboard/registry';

export type TerminalFindKey = 'open' | 'next' | 'previous' | null;

type Params = {
  readonly event: KeyboardEvent;
  readonly isOpen: boolean;
};

export const terminalFindKey = ({ event, isOpen }: Params): TerminalFindKey => {
  if (event.type !== 'keydown') {
    return null;
  }
  if (eventMatches({ event, entry: SHORTCUTS['search.open'] })) {
    return 'open';
  }
  if (!isOpen) {
    return null;
  }
  if (eventMatches({ event, entry: SHORTCUTS['find.next'] })) {
    return 'next';
  }
  return eventMatches({ event, entry: SHORTCUTS['find.previous'] }) ? 'previous' : null;
};
