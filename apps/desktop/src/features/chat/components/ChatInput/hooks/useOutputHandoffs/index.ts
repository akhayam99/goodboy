import { useEffect, useRef, type RefObject } from 'react';
import type { AgentId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../../store';
import { focusComposerTextarea } from '../../focusComposerTextarea';
import type { AttachOutputHandoffsParams } from '../useAttachments';

type Params = {
  readonly selectedAgentId: AgentId | null;
  readonly isReady: boolean;
  readonly wrapperRef: RefObject<HTMLDivElement | null>;
  readonly attachOutputHandoffs: (params: AttachOutputHandoffsParams) => Promise<boolean>;
};

export const useOutputHandoffs = ({
  selectedAgentId,
  isReady,
  wrapperRef,
  attachOutputHandoffs,
}: Params): void => {
  const queued = useAppStore((state) =>
    selectedAgentId === null ? EMPTY_ARRAY : (state.outputHandoffs[selectedAgentId] ?? EMPTY_ARRAY),
  );
  const consumeOutputHandoffs = useAppStore((state) => state.consumeOutputHandoffs);
  const inFlight = useRef<ReadonlySet<string>>(new Set());

  useEffect(() => {
    if (selectedAgentId === null || !isReady) {
      return;
    }
    const fresh = queued.filter((handoff) => !inFlight.current.has(handoff.id));
    if (fresh.length === 0) {
      return;
    }
    const ids = fresh.map((handoff) => handoff.id);
    inFlight.current = new Set([...inFlight.current, ...ids]);
    void attachOutputHandoffs({ agentId: selectedAgentId, handoffs: fresh })
      .then((isApplied) => {
        if (!isApplied) {
          return;
        }
        consumeOutputHandoffs({ agentId: selectedAgentId, ids });
        focusComposerTextarea(wrapperRef);
      })
      .finally(() => {
        inFlight.current = new Set([...inFlight.current].filter((id) => !ids.includes(id)));
      });
  }, [selectedAgentId, isReady, queued, attachOutputHandoffs, consumeOutputHandoffs, wrapperRef]);
};
