import type { SetFn, SetPullRequestModeParams } from './types';

type Params = { readonly set: SetFn } & SetPullRequestModeParams;

export const setPullRequestMode = ({ set, sessionId, mode }: Params): void => {
  set((state) => {
    const current = state.pullRequestModes[sessionId] ?? 'overview';
    if (current === mode) {
      return state;
    }
    return { pullRequestModes: { ...state.pullRequestModes, [sessionId]: mode } };
  });
};
