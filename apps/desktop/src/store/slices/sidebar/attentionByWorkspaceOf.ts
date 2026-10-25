import type { WorkspaceAttentionEntry, WorkspaceAttentionMap } from './state';

type Params = {
  readonly fromDatabase: WorkspaceAttentionMap;
  readonly fromWindows: WorkspaceAttentionMap;
  readonly shownIds: ReadonlySet<string>;
};

export const attentionByWorkspaceOf = ({
  fromDatabase,
  fromWindows,
  shownIds,
}: Params): WorkspaceAttentionMap => {
  const ids = new Set([...Object.keys(fromDatabase), ...Object.keys(fromWindows)]);
  const merged: Record<string, WorkspaceAttentionEntry> = {};
  for (const id of ids) {
    const fromWindow = shownIds.has(id) ? fromWindows[id] : undefined;
    const entry = fromWindow ?? fromDatabase[id];
    if (entry !== undefined && entry.count > 0) {
      merged[id] = entry;
    }
  }
  return merged;
};
