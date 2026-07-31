import { useEffect, useRef } from 'react';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { TranscriptItem } from '../../utils/transcript-items';

type Params = {
  items: ReadonlyArray<TranscriptItem>;
  sessionId: SessionId;
  agentId: AgentId | null;
};

export const useTranscriptErrorToasts = ({ items, sessionId, agentId }: Params) => {
  const emitNotification = useAppStore((state) => state.emitNotification);
  const seen = useRef<Set<string>>(new Set());
  const primed = useRef(false);

  useEffect(() => {
    seen.current = new Set();
    primed.current = false;
  }, [agentId]);

  useEffect(() => {
    const fresh: Array<TranscriptItem> = [];
    for (const item of items) {
      if (item.kind !== 'error' || seen.current.has(item.key)) {
        continue;
      }
      seen.current.add(item.key);
      fresh.push(item);
    }
    if (!primed.current) {
      primed.current = true;
      return;
    }
    for (const item of fresh) {
      if (item.kind !== 'error') {
        continue;
      }
      void emitNotification('error', 'error', 'agent run failed', item.message, { sessionId });
    }
  }, [items, emitNotification, sessionId]);
};
