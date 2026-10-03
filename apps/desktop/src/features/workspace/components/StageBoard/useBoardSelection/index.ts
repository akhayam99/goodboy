import { useCallback, useMemo, useRef } from 'react';
import type { Session, SessionId } from '@goodboy/types';
import { useMultiSelect, type MultiSelect } from '../../../../../shared/hooks/useMultiSelect';

type ToggleEvent = {
  readonly shiftKey: boolean;
};

type ClickEvent = Parameters<MultiSelect<SessionId>['handleItemClick']>[1];

export type BoardSelection = {
  readonly active: MultiSelect<SessionId>;
  readonly archived: MultiSelect<SessionId>;
  readonly scope: 'active' | 'archived';
  readonly selectedSessions: ReadonlyArray<Session>;
  readonly selectedIds: ReadonlyArray<SessionId>;
  readonly total: number;
  readonly clearAll: () => void;
  readonly selectAll: () => void;
  readonly isSelected: (id: SessionId) => boolean;
  readonly getSelectedIds: () => ReadonlyArray<SessionId>;
  readonly onItemClick: (id: SessionId, event: ClickEvent) => void;
  readonly onToggle: (id: SessionId, event?: ToggleEvent) => void;
};

type Args = {
  readonly activeSessions: ReadonlyArray<Session>;
  readonly archivedSessions: ReadonlyArray<Session>;
};

const exclusive = (
  self: MultiSelect<SessionId>,
  otherClear: () => void,
): MultiSelect<SessionId> => ({
  ...self,
  toggle: (id) => {
    otherClear();
    self.toggle(id);
  },
  selectRange: (id) => {
    otherClear();
    self.selectRange(id);
  },
  selectAll: () => {
    otherClear();
    self.selectAll();
  },
  selectIds: (ids, mode) => {
    otherClear();
    self.selectIds(ids, mode);
  },
  handleItemClick: (id, event) => {
    otherClear();
    self.handleItemClick(id, event);
  },
});

export const useBoardSelection = ({ activeSessions, archivedSessions }: Args): BoardSelection => {
  const activeOrder = useMemo(
    () => activeSessions.map((session) => session.id as SessionId),
    [activeSessions],
  );
  const archivedOrder = useMemo(
    () => archivedSessions.map((session) => session.id as SessionId),
    [archivedSessions],
  );

  const activeSelection = useMultiSelect(activeOrder);
  const archivedSelection = useMultiSelect(archivedOrder);
  const clearActive = activeSelection.clear;
  const clearArchived = archivedSelection.clear;

  const active = useMemo(
    () => exclusive(activeSelection, clearArchived),
    [activeSelection, clearArchived],
  );
  const archived = useMemo(
    () => exclusive(archivedSelection, clearActive),
    [archivedSelection, clearActive],
  );

  const clearAll = useCallback(() => {
    clearActive();
    clearArchived();
  }, [clearActive, clearArchived]);

  const scope: 'active' | 'archived' =
    archivedSelection.selected.length > 0 ? 'archived' : 'active';

  const activeChosen = activeSelection.selected;
  const archivedChosen = archivedSelection.selected;
  const selectedSessions = useMemo(() => {
    const chosen = new Set<string>(scope === 'archived' ? archivedChosen : activeChosen);
    const pool = scope === 'archived' ? archivedSessions : activeSessions;
    return pool.filter((session) => chosen.has(session.id));
  }, [scope, activeSessions, archivedSessions, activeChosen, archivedChosen]);

  const selectedIds = useMemo(
    () => selectedSessions.map((session) => session.id as SessionId),
    [selectedSessions],
  );
  const archivedIdSet = useMemo(() => new Set(archivedOrder), [archivedOrder]);

  const latest = useRef({ active, archived, archivedIdSet, selectedIds });
  latest.current = { active, archived, archivedIdSet, selectedIds };

  const getSelectedIds = useCallback(() => latest.current.selectedIds, []);

  const isSelected = useMemo(() => {
    const chosen = new Set(selectedIds);
    return (id: SessionId) => chosen.has(id);
  }, [selectedIds]);

  const ownerOf = useCallback((id: SessionId) => {
    const {
      active: activeOwner,
      archived: archivedOwner,
      archivedIdSet: archivedIds,
    } = latest.current;
    return archivedIds.has(id) ? archivedOwner : activeOwner;
  }, []);

  const onItemClick = useCallback(
    (id: SessionId, event: ClickEvent) => ownerOf(id).handleItemClick(id, event),
    [ownerOf],
  );

  const onToggle = useCallback(
    (id: SessionId, event?: ToggleEvent) => {
      const owner = ownerOf(id);
      if (event?.shiftKey === true) {
        owner.selectRange(id);
        return;
      }
      owner.toggle(id);
    },
    [ownerOf],
  );

  const selectAll = useCallback(() => {
    const { active: activeOwner, archived: archivedOwner } = latest.current;
    if (archivedSelection.selected.length > 0) {
      archivedOwner.selectAll();
      return;
    }
    activeOwner.selectAll();
  }, [archivedSelection.selected.length]);

  const total = scope === 'archived' ? archivedOrder.length : activeOrder.length;

  return {
    active,
    archived,
    scope,
    selectedSessions,
    selectedIds,
    total,
    clearAll,
    selectAll,
    isSelected,
    getSelectedIds,
    onItemClick,
    onToggle,
  };
};
