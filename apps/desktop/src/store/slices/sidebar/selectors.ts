import { useMemo } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { attentionByWorkspaceOf } from './attentionByWorkspaceOf';
import { attentionElsewhereOf, type AttentionElsewhere } from './attentionElsewhereOf';
import type { WorkspaceAttentionEntry, WorkspaceAttentionMap } from './state';

export const useWorkspaceHasUnread = (workspaceId: WorkspaceId | null): boolean =>
  useAppStore((s) => (workspaceId ? s.unreadWorkspaceIds.has(workspaceId) : false));

export const useHasUnreadElsewhere = (currentId: WorkspaceId | null): boolean => {
  const unread = useAppStore((s) => s.unreadWorkspaceIds);
  const presence = useAppStore((s) => s.windowPresence);
  return useMemo(() => {
    const shown = new Set<WorkspaceId>();
    for (const ws of Object.values(presence))
      if (ws) {
        shown.add(ws);
      }
    for (const id of unread)
      if (id !== currentId && !shown.has(id)) {
        return true;
      }
    return false;
  }, [unread, presence, currentId]);
};

type ByWorkspaceParams = {
  readonly currentId: WorkspaceId | null;
};

const useAttentionByWorkspace = ({ currentId }: ByWorkspaceParams): WorkspaceAttentionMap => {
  const fromDatabase = useAppStore((s) => s.attentionFromDatabase);
  const fromWindows = useAppStore((s) => s.attentionFromWindows);
  const shownKey = useAppStore((s) =>
    Object.values(s.windowPresence)
      .flatMap((id) => (id === null ? [] : [id]))
      .sort()
      .join('\n'),
  );
  return useMemo(() => {
    const shownIds = new Set<string>(shownKey === '' ? [] : shownKey.split('\n'));
    if (currentId !== null) {
      shownIds.add(currentId);
    }
    return attentionByWorkspaceOf({ fromDatabase, fromWindows, shownIds });
  }, [fromDatabase, fromWindows, shownKey, currentId]);
};

type AttentionOfParams = {
  readonly workspaceId: WorkspaceId;
};

export const useWorkspaceAttentionEntry = ({
  workspaceId,
}: AttentionOfParams): WorkspaceAttentionEntry | null => {
  const byWorkspace = useAttentionByWorkspace({ currentId: null });
  return byWorkspace[workspaceId] ?? null;
};

type ElsewhereParams = {
  readonly currentId: WorkspaceId | null;
};

export const useAttentionElsewhere = ({ currentId }: ElsewhereParams): AttentionElsewhere => {
  const byWorkspace = useAttentionByWorkspace({ currentId });
  return useMemo(() => attentionElsewhereOf({ byWorkspace, currentId }), [byWorkspace, currentId]);
};
