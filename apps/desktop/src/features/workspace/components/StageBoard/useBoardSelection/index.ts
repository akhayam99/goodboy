import { useCallback, useMemo } from 'react';
import type { Session, SessionId } from '@goodboy/types';
import { useMultiSelect, type MultiSelect } from '../../../../../shared/hooks/useMultiSelect';

export type BoardSelection = {
  readonly active: MultiSelect<SessionId>;
  readonly archived: MultiSelect<SessionId>;
  readonly scope: 'active' | 'archived';
  readonly selectedSessions: ReadonlyArray<Session>;
  readonly clearAll: () => void;
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

  const selectedSessions = useMemo(
    () =>
      scope === 'archived'
        ? archivedSessions.filter((session) =>
            archivedSelection.isSelected(session.id as SessionId),
          )
        : activeSessions.filter((session) => activeSelection.isSelected(session.id as SessionId)),
    [scope, activeSessions, archivedSessions, activeSelection, archivedSelection],
  );

  return { active, archived, scope, selectedSessions, clearAll };
};
