import { useCallback, useMemo, useRef } from 'react';
import type { Session, SessionId } from '@goodboy/types';
import { useMultiSelect, type MultiSelect } from '../../../../../shared/hooks/useMultiSelect';

type ToggleEvent = {
  readonly shiftKey: boolean;
};

type ClickEvent = Parameters<MultiSelect<SessionId>['handleItemClick']>[1];

export type BoardSelection = {
  readonly selectedSessions: ReadonlyArray<Session>;
  readonly selectedIds: ReadonlyArray<SessionId>;
  readonly total: number;
  readonly clearAll: () => void;
  readonly selectAll: () => void;
  readonly selectIds: MultiSelect<SessionId>['selectIds'];
  readonly isSelected: (id: SessionId) => boolean;
  readonly getSelectedIds: () => ReadonlyArray<SessionId>;
  readonly onItemClick: (id: SessionId, event: ClickEvent) => void;
  readonly onToggle: (id: SessionId, event?: ToggleEvent) => void;
};

type Args = {
  readonly sessions: ReadonlyArray<Session>;
};

export const useBoardSelection = ({ sessions }: Args): BoardSelection => {
  const order = useMemo(() => sessions.map((session) => session.id as SessionId), [sessions]);
  const multi = useMultiSelect(order);
  const { selected, selectAll, selectIds, clear, handleItemClick, selectRange, toggle } = multi;

  const selectedSessions = useMemo(() => {
    const chosen = new Set<string>(selected);
    return sessions.filter((session) => chosen.has(session.id));
  }, [selected, sessions]);

  const selectedIds = useMemo(
    () => selectedSessions.map((session) => session.id as SessionId),
    [selectedSessions],
  );

  const latest = useRef({ selectedIds });
  latest.current = { selectedIds };

  const getSelectedIds = useCallback(() => latest.current.selectedIds, []);

  const isSelected = useMemo(() => {
    const chosen = new Set(selectedIds);
    return (id: SessionId) => chosen.has(id);
  }, [selectedIds]);

  const onToggle = useCallback(
    (id: SessionId, event?: ToggleEvent) => {
      if (event?.shiftKey === true) {
        selectRange(id);
        return;
      }
      toggle(id);
    },
    [selectRange, toggle],
  );

  return {
    selectedSessions,
    selectedIds,
    total: order.length,
    clearAll: clear,
    selectAll,
    selectIds,
    isSelected,
    getSelectedIds,
    onItemClick: handleItemClick,
    onToggle,
  };
};
