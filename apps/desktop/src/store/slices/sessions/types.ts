import type { SessionId } from '@goodboy/types';

export type { SetFn, GetFn } from '../../slice-types';

export type BulkSessionResult = {
  readonly succeeded: ReadonlyArray<SessionId>;
  readonly failed: ReadonlyArray<SessionId>;
};
