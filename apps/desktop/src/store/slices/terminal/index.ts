import { closeTerminal } from './closeTerminal';
import { openTerminal } from './openTerminal';
import type { GetFn, SetFn } from './types';

export function createTerminalSlice(set: SetFn, _get: GetFn) {
  return {
    openTerminal: openTerminal(set),
    closeTerminal: closeTerminal(set),
  };
}
