import { useCallback, useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { STORAGE_PREFIXES } from '../../../../shared/lib/storage-keys';

export type BoardCollapsibleColumn = 'done' | 'archived';

export type BoardCollapseState = Readonly<Record<BoardCollapsibleColumn, boolean>>;

const DEFAULT_STATE: BoardCollapseState = { done: true, archived: true };

type Params = {
  readonly workspaceId: WorkspaceId;
};

type WriteParams = {
  readonly workspaceId: WorkspaceId;
  readonly next: BoardCollapseState;
};

type SetParams = {
  readonly column: BoardCollapsibleColumn;
  readonly isCollapsed: boolean;
};

const keyFor = ({ workspaceId }: Params): string =>
  `${STORAGE_PREFIXES.boardCollapsed}${workspaceId}`;

const isCollapseState = (value: unknown): value is BoardCollapseState => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.done === 'boolean' && typeof record.archived === 'boolean';
};

const readState = ({ workspaceId }: Params): BoardCollapseState => {
  if (typeof localStorage === 'undefined') {
    return DEFAULT_STATE;
  }
  try {
    const raw = localStorage.getItem(keyFor({ workspaceId }));
    if (raw === null) {
      return DEFAULT_STATE;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isCollapseState(parsed)) {
      return DEFAULT_STATE;
    }
    return { done: parsed.done, archived: parsed.archived };
  } catch {
    return DEFAULT_STATE;
  }
};

const writeState = ({ workspaceId, next }: WriteParams): void => {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(keyFor({ workspaceId }), JSON.stringify(next));
  } catch {
    return;
  }
};

type Held = {
  readonly workspaceId: WorkspaceId;
  readonly value: BoardCollapseState;
};

export const useBoardCollapse = ({ workspaceId }: Params) => {
  const [held, setHeld] = useState<Held>(() => ({
    workspaceId,
    value: readState({ workspaceId }),
  }));

  const current =
    held.workspaceId === workspaceId ? held : { workspaceId, value: readState({ workspaceId }) };
  if (current !== held) {
    setHeld(current);
  }

  const setCollapsed = useCallback(
    ({ column, isCollapsed }: SetParams) => {
      setHeld((prev) => {
        const base = prev.workspaceId === workspaceId ? prev.value : readState({ workspaceId });
        const next = { ...base, [column]: isCollapsed };
        writeState({ workspaceId, next });
        return { workspaceId, value: next };
      });
    },
    [workspaceId],
  );

  return { collapsed: current.value, setCollapsed };
};
