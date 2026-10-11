import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { useSessionLastTurnFinishedAt } from '../../agents/selectors';
import { useMountDiffTick } from '../useMountDiffTick';

export const useMountDiffRevision = (sessionId: SessionId | null): string => {
  const lastTurnFinishedAt = useSessionLastTurnFinishedAt(sessionId);
  const summarizerLastUpdate = useAppStore((s) =>
    sessionId == null ? null : (s.summarizerStatus[sessionId]?.lastUpdate ?? null),
  );
  const tick = useMountDiffTick();
  return `${String(lastTurnFinishedAt)}|${String(summarizerLastUpdate)}|${tick}`;
};
