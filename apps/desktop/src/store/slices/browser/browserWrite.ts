import type { SessionId, WorkspaceId } from '@goodboy/types';
import { commitAfterConfirm } from '../../runtime/state-writes/commitAfterConfirm';
import { browserWrites } from './browserWrites';
import type { GetFn } from './types';

type CommitParams<Value> = {
  readonly value: Value;
};

type Params<Value> = {
  readonly get: GetFn;
  readonly failureTitle: string;
  readonly target: { readonly sessionId?: SessionId; readonly workspaceId?: WorkspaceId };
  readonly step: () => Promise<Value>;
  readonly commit: (params: CommitParams<Value>) => void;
};

const applyNothing = (): void => undefined;

export const browserWrite = async <Value>({
  get,
  failureTitle,
  target,
  step,
  commit,
}: Params<Value>): Promise<boolean> => {
  const result = await browserWrites.queue.run({
    key: browserWrites.writeKey,
    task: async () => {
      const outcome = await commitAfterConfirm({
        get,
        failureTitle,
        target,
        step,
        commit: applyNothing,
      });
      if (outcome.isOk) {
        commit({ value: outcome.value });
      }
      return outcome;
    },
  });
  return result.isOk;
};
