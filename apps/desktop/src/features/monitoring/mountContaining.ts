import type { OwnedMount } from './ownedMountsOf';

type Params = {
  readonly mounts: ReadonlyArray<OwnedMount>;
  readonly sessionId: string | null;
  readonly path: string | null;
};

type TrimParams = {
  readonly path: string;
};

const trimmed = ({ path }: TrimParams): string => {
  let end = path.length;
  while (end > 1 && path.charAt(end - 1) === '/') {
    end -= 1;
  }
  return path.slice(0, end);
};

export const mountContaining = ({ mounts, sessionId, path }: Params): OwnedMount | null => {
  if (path === null || path === '') {
    return null;
  }
  const where = trimmed({ path });
  let best: OwnedMount | null = null;
  for (const mount of mounts) {
    if (sessionId !== null && mount.sessionId !== sessionId) {
      continue;
    }
    const root = trimmed({ path: mount.worktreePath });
    const isInside = where === root || where.startsWith(`${root}/`);
    if (isInside && (best === null || root.length > best.worktreePath.length)) {
      best = mount;
    }
  }
  return best;
};
