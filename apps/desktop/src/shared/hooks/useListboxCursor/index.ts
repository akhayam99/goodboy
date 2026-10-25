import { useCallback, useEffect, useState, type RefObject } from 'react';

type Params = {
  readonly ids: ReadonlyArray<string>;
  readonly listRef: RefObject<HTMLElement | null>;
  readonly listboxId: string;
  readonly defaultId?: string | null;
};

type SelectParams = {
  readonly id: string | null;
};

type MoveParams = {
  readonly delta: number;
};

type OptionIdParams = {
  readonly id: string;
};

export type ListboxCursor = {
  readonly activeId: string | null;
  readonly selectedIndex: number;
  readonly select: (params: SelectParams) => void;
  readonly move: (params: MoveParams) => void;
  readonly optionId: (params: OptionIdParams) => string;
};

export const useListboxCursor = ({
  ids,
  listRef,
  listboxId,
  defaultId = null,
}: Params): ListboxCursor => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const wantedId = selectedId ?? defaultId;
  const selectedIndex = Math.max(
    0,
    ids.findIndex((id) => id === wantedId),
  );
  const activeId = ids[selectedIndex] ?? null;
  const optionId = useCallback(({ id }: OptionIdParams) => `${listboxId}-${id}`, [listboxId]);
  const select = useCallback(({ id }: SelectParams) => setSelectedId(id), []);
  const move = useCallback(
    ({ delta }: MoveParams) => {
      const next = ids[Math.min(Math.max(selectedIndex + delta, 0), ids.length - 1)];
      if (next !== undefined) {
        setSelectedId(next);
      }
    },
    [ids, selectedIndex],
  );

  useEffect(() => {
    if (activeId === null) {
      return;
    }
    listRef.current
      ?.querySelector(`#${CSS.escape(optionId({ id: activeId }))}`)
      ?.scrollIntoView?.({ block: 'nearest' });
  }, [activeId, optionId, listRef]);

  return { activeId, selectedIndex, select, move, optionId };
};
