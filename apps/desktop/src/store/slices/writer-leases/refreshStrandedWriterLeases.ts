import { listUnknownWriterLeases } from '../../../features/worktree/writerLease';
import type { GetFn, SetFn } from './types';

export const refreshStrandedWriterLeases = ({
  set,
}: {
  readonly set: SetFn;
  readonly get: GetFn;
}) => {
  return async (): Promise<void> => {
    const leases = await listUnknownWriterLeases();
    set(() => ({ strandedWriterLeases: leases }));
  };
};
