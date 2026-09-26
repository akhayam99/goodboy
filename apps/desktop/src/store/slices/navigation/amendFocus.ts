import { currentStack, stackKey } from './currentStack';
import { replaceTop } from './history';
import type { AmendFocusParams, GetFn, SetFn } from './types';

export const amendFocus = (set: SetFn, get: GetFn) => {
  return ({ patch }: AmendFocusParams): void => {
    const stack = currentStack(get());
    const top = stack.entries[stack.index];
    if (top === undefined) {
      return;
    }
    const updated = replaceTop({ stack, next: { ...top, focus: { ...top.focus, ...patch } } });
    set((current) => ({ navigation: { ...current.navigation, [stackKey(current)]: updated } }));
  };
};
