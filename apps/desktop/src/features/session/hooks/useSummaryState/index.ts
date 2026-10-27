import { useEffect } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore, useSessionSlots, useSlotHistory } from '../../../../store';
import { requestChangedAtOf } from '../../../../store/slices/session-view/requestChangedAtOf';
import { latestStampMs } from '../../../../store/slices/session-view/latestStampMs';
import { useNow } from '../../../../shared/hooks/useNow';
import { summaryStateOf, type SummaryState } from '../../central/summary/summaryStateOf';

const SUMMARY_SLOT = 'last_output_summary';

const MINUTE_MS = 60_000;

type Params = {
  readonly sessionId: SessionId;
};

export const useSummaryState = ({ sessionId }: Params): SummaryState | null => {
  const slots = useSessionSlots(sessionId);
  const history = useSlotHistory(sessionId, SUMMARY_SLOT);
  const lastUpdate = useAppStore((state) => state.summarizerStatus[sessionId]?.lastUpdate ?? null);
  const branchChangedAtMs = useAppStore((state) => requestChangedAtOf({ state, sessionId }));
  const loadSlotHistory = useAppStore((state) => state.loadSlotHistory);
  const nowMs = useNow(MINUTE_MS);
  const text = slots.find((slot) => slot.key === SUMMARY_SLOT)?.value ?? '';
  const hasText = text.trim() !== '';
  const isHistoryKnown = history.length > 0;

  useEffect(() => {
    if (hasText && !isHistoryKnown) {
      void loadSlotHistory(sessionId, SUMMARY_SLOT);
    }
  }, [hasText, isHistoryKnown, loadSlotHistory, sessionId]);

  if (!hasText) {
    return null;
  }
  return summaryStateOf({
    text,
    updatedAtMs: latestStampMs({ stamps: [history[0]?.createdAt ?? lastUpdate] }),
    nowMs,
    branchChangedAtMs,
  });
};
