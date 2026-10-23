import type { MountId } from '@goodboy/types';
import { localCheckOf, type PushAnswer } from './localCheckOf';
import type { SetFn } from './types';

type Params = {
  readonly set: SetFn;
};

type RecordParams = {
  readonly mountId: MountId;
  readonly answer: PushAnswer;
  readonly at: number;
};

export const recordLocalCheck =
  ({ set }: Params) =>
  ({ mountId, answer, at }: RecordParams): void => {
    const result = localCheckOf({ answer, at });
    if (result === null) {
      return;
    }
    set((state) => ({ mountLocalChecks: { ...state.mountLocalChecks, [mountId]: result } }));
  };
