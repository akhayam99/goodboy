import type { SessionId } from '@goodboy/types';
import type { NextGroupId } from '../../../features/session/central/next/nextGroupIds';
import type { SetFn } from './types';

type Params = {
  readonly set: SetFn;
};

type ChooseParams = {
  readonly sessionId: SessionId;
  readonly groupId: NextGroupId;
  readonly isOpen: boolean;
};

export const chooseNextGroup =
  ({ set }: Params) =>
  ({ sessionId, groupId, isOpen }: ChooseParams): void => {
    set((state) => {
      const current = state.nextGroupChoice[sessionId] ?? {};
      if (current[groupId] === isOpen) {
        return {};
      }
      return {
        nextGroupChoice: {
          ...state.nextGroupChoice,
          [sessionId]: { ...current, [groupId]: isOpen },
        },
      };
    });
  };
