import { useCallback, useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { STORAGE_PREFIXES, persistedPref } from '../../../../shared/lib/storage-keys';

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

const statePref = ({ workspaceId }: Params) =>
  persistedPref<BoardCollapseState>({
    key: keyFor({ workspaceId }),
    fallback: DEFAULT_STATE,
    parse: (raw) => {
      const parsed: unknown = JSON.parse(raw);
      return isCollapseState(parsed) ? { done: parsed.done, archived: parsed.archived } : undefined;
    },
  });

const readState = ({ workspaceId }: Params): BoardCollapseState =>
  statePref({ workspaceId }).read();

const writeState = ({ workspaceId, next }: WriteParams): void =>
  statePref({ workspaceId }).write(next);

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
