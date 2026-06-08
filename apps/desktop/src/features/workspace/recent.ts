import type { Workspace } from '@goodboy/types';

export function sortWorkspacesByRecent(list: ReadonlyArray<Workspace>): ReadonlyArray<Workspace> {
  return [...list].sort((a, b) => {
    const at = a.lastAccessedAt ?? '';
    const bt = b.lastAccessedAt ?? '';
    if (at !== bt) return at < bt ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
}

export function filterWorkspaces(
  list: ReadonlyArray<Workspace>,
  query: string,
): ReadonlyArray<Workspace> {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (w) => w.name.toLowerCase().includes(q) || w.rootPath.toLowerCase().includes(q),
  );
}
