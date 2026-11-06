import type { SessionId } from '@goodboy/types';
import type { GroupBy } from './state';
import type { SetFn } from './types';

type Params = {
  readonly set: SetFn;
};

type SetParams = {
  readonly sessionId: SessionId;
  readonly groupBy: GroupBy;
};

export const setGroupBy =
  ({ set }: Params) =>
  ({ sessionId, groupBy }: SetParams): void => {
    set((state) => {
      if (state.groupBySession[sessionId] === groupBy) {
        return {};
      }
      return { groupBySession: { ...state.groupBySession, [sessionId]: groupBy } };
    });
  };
