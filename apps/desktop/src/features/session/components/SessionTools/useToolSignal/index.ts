import { useEffect } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore, useSummarizerStatus } from '../../../../../store';
import { selectHasContextChange } from '../../../../../store/slices/contextDrawer/selectHasContextChange';
import { contextNoteOf } from '../contextNote';

export type ToolSignal = {
  readonly kind: 'changed' | 'running' | 'error';
  readonly note: string;
};

type Params = {
  readonly sessionId: SessionId;
  readonly isContextOpen: boolean;
};

export const useToolSignal = ({ sessionId, isContextOpen }: Params): ToolSignal | null => {
  const { status } = useSummarizerStatus(sessionId);
  const hasChange = useAppStore(
    (state) => !isContextOpen && selectHasContextChange({ state, sessionId }),
  );
  const hasLedger = useAppStore((state) => state.sessionDecisions[sessionId] !== undefined);
  const loadSessionContextSeen = useAppStore((state) => state.loadSessionContextSeen);
  const loadSessionDecisions = useAppStore((state) => state.loadSessionDecisions);

  useEffect(() => {
    void loadSessionContextSeen(sessionId);
  }, [loadSessionContextSeen, sessionId]);

  useEffect(() => {
    if (hasLedger) {
      return;
    }
    void loadSessionDecisions(sessionId);
  }, [hasLedger, loadSessionDecisions, sessionId]);

  const note = contextNoteOf({ status, hasChange });
  if (note === null) {
    return null;
  }
  if (status === 'running') {
    return { kind: 'running', note };
  }
  return { kind: status === 'error' ? 'error' : 'changed', note };
};
