import {
  listUnknownWriterLeases,
  releaseUnknownWriterLease,
  type UnknownWriterLeaseRelease,
} from '../../../features/worktree/writerLease';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly leaseId: string;
  readonly releasedBy: string;
  readonly releaseEvidence: string;
};

const refusalDetail = ({
  outcome,
}: {
  readonly outcome: Exclude<UnknownWriterLeaseRelease, { readonly kind: 'released' }>;
}): string => {
  switch (outcome.kind) {
    case 'not-found':
      return 'that lease is no longer recorded';
    case 'not-stranded':
      return `that lease is ${outcome.state}, not stranded, so it cannot be cleared this way`;
    case 'owner-alive':
      return `the process holding it (${outcome.processId}) is still running, so clearing it would let two writers into one checkout`;
    case 'evidence-missing':
      return 'a release has to say who cleared it and on what evidence';
    case 'unavailable':
      return 'the release could not be recorded';
    default: {
      const exhaustive: never = outcome;
      return exhaustive;
    }
  }
};

export const releaseStrandedWriterLease = ({
  set,
  get,
}: {
  readonly set: SetFn;
  readonly get: GetFn;
}) => {
  return async ({
    leaseId,
    releasedBy,
    releaseEvidence,
  }: Params): Promise<UnknownWriterLeaseRelease> => {
    if (releasedBy.trim().length === 0 || releaseEvidence.trim().length === 0) {
      return { kind: 'evidence-missing', id: leaseId };
    }
    const outcome = await releaseUnknownWriterLease({
      leaseId,
      releasedBy,
      evidence: releaseEvidence,
    });
    const leases = await listUnknownWriterLeases();
    set(() => ({ strandedWriterLeases: leases }));
    if (outcome.kind === 'released') {
      void get().emitNotification(
        'error',
        'info',
        'writer lease released',
        `${releasedBy} cleared the lease ${outcome.holder} left behind: ${releaseEvidence}`,
      );
      return outcome;
    }
    void get().emitNotification(
      'error',
      'warning',
      'writer lease not released',
      refusalDetail({ outcome }),
    );
    return outcome;
  };
};
