import type { SliceDeps } from '../../slice-types';
import { currentStack } from './currentStack';
import { goHistory } from './goHistory';

export const closeQuestion = ({ set, get }: SliceDeps) => {
  return (): void => {
    const state = get();
    const drawer = state.drawer ?? null;
    if (drawer === null || drawer.kind !== 'question') {
      return;
    }
    const stack = currentStack(state);
    if (stack.entries[stack.index - 1] !== undefined && goHistory({ set, get, delta: -1 })) {
      return;
    }
    state.closeDrawer();
    if (drawer.payload.from === 'ask') {
      state.openAsk({ sessionId: drawer.sessionId });
    }
  };
};
