import type { PortRow } from '@goodboy/core/monitoring';
import type { SessionMountView } from '@goodboy/types';

type Params = {
  readonly row: PortRow;
  readonly sessionMounts: Readonly<Record<string, ReadonlyArray<SessionMountView>>>;
};

export const portBranchOf = ({ row, sessionMounts }: Params): string | null => {
  const { owner } = row;
  if (owner === null || owner.kind === 'external' || owner.kind === 'project') {
    return null;
  }
  if (owner.sessionId === null) {
    return null;
  }
  const mounts = sessionMounts[owner.sessionId] ?? [];
  const mount = mounts.find((item) => item.worktreePath === owner.worktreePath);
  return mount?.branch ?? null;
};
