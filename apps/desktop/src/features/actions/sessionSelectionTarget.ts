import type { SessionId } from '@goodboy/types';
import type { ObjectTarget } from './types';

type Params = {
  readonly sessionId: SessionId;
  readonly selectedIds: ReadonlyArray<SessionId>;
  readonly clearSelection: () => void;
};

export const sessionSelectionTarget = ({
  sessionId,
  selectedIds,
  clearSelection,
}: Params): ObjectTarget => {
  if (selectedIds.includes(sessionId) && selectedIds.length > 1) {
    return { kind: 'sessions', sessionIds: selectedIds };
  }
  if (selectedIds.length > 0 && !selectedIds.includes(sessionId)) {
    clearSelection();
  }
  return { kind: 'session', sessionId };
};
