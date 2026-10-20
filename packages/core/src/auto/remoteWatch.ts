import type { ResultRemote } from './result';

export type RemoteRead =
  | Readonly<{ kind: 'sha'; branch: string; sha: string }>
  | Readonly<{ kind: 'absent'; branch: string }>
  | Readonly<{ kind: 'unknown' }>;

export type RemoteVerdictParams = Readonly<{
  before: RemoteRead | null;
  after: RemoteRead;
}>;

type ShaParams = {
  readonly read: RemoteRead;
};

const shaOf = ({ read }: ShaParams): string | null => (read.kind === 'sha' ? read.sha : null);

export const remoteVerdictOf = ({ before, after }: RemoteVerdictParams): ResultRemote | null => {
  if (before === null) {
    return null;
  }
  if (before.kind === 'unknown' || after.kind === 'unknown' || before.branch !== after.branch) {
    return {
      status: 'unknown',
      branch: before.kind === 'unknown' ? null : before.branch,
      before: null,
      after: null,
    };
  }
  const beforeSha = shaOf({ read: before });
  const afterSha = shaOf({ read: after });
  return {
    status: beforeSha === afterSha ? 'unchanged' : 'moved',
    branch: before.branch,
    before: beforeSha,
    after: afterSha,
  };
};
