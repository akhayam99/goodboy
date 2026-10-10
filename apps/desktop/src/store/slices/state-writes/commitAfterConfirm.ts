import type { SessionId, WorkspaceId } from '@goodboy/types';
import type { GetFn } from '../../slice-types';
import { isReportedError } from '../notifications/reportedError';

export type CommitTarget = {
  readonly sessionId?: SessionId;
  readonly workspaceId?: WorkspaceId;
};

export type CommitResult<Value> =
  | { readonly isOk: true; readonly value: Value }
  | { readonly isOk: false; readonly error: unknown };

type Params<Value> = {
  readonly get: GetFn;
  readonly failureTitle: string;
  readonly target: CommitTarget;
  readonly step: () => Promise<Value>;
  readonly commit: (value: Value) => void;
};

export const commitAfterConfirm = async <Value>({
  get,
  failureTitle,
  target,
  step,
  commit,
}: Params<Value>): Promise<CommitResult<Value>> => {
  let value: Value;
  try {
    value = await step();
  } catch (error) {
    if (!isReportedError(error)) {
      await get().reportError({ title: failureTitle, error, ...target });
    }
    return { isOk: false, error };
  }
  commit(value);
  return { isOk: true, value };
};
