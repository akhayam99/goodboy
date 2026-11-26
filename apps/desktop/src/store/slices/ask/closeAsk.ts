import { selectGridTool } from '../drawer/selectGridTool';
import type { AskSessionParams, GetFn } from './types';

type Params = {
  readonly get: GetFn;
};

export const closeAsk =
  ({ get }: Params) =>
  ({ sessionId }: AskSessionParams): void => {
    const state = get();
    const shown = selectGridTool({ state, kind: 'ask' });
    if (shown === null || shown.sessionId !== sessionId) {
      return;
    }
    state.closeDrawerEntry({ entry: shown });
  };
