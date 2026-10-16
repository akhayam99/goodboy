import { currentStack, stackKey } from './currentStack';
import { replaceTop } from './history';
import { SIDEBAR_LEVEL_KEY } from './sidebarLevel';
import type { GetFn, SetFn } from './types';

export const leaveSessionLevel = (set: SetFn, get: GetFn) => {
  return (): void => {
    const stack = currentStack(get());
    const top = stack.entries[stack.index];
    if (top === undefined || top.place.at !== 'session') {
      return;
    }
    const selection = { ...top.focus.selection, [SIDEBAR_LEVEL_KEY]: 'workspace' };
    const updated = replaceTop({ stack, next: { ...top, focus: { ...top.focus, selection } } });
    set((current) => ({ navigation: { ...current.navigation, [stackKey(current)]: updated } }));
  };
};
