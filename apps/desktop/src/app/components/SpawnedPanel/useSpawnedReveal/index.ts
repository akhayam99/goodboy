import { useEffect, useRef, type RefObject } from 'react';
import type { AgentId } from '@goodboy/types';
import { foldAncestorsOf } from '../foldAncestorsOf';
import type { FoldedSpawnedRow } from '../foldSpawnedRowsOf';
import type { SpawnedRow } from '../spawnedRow';

type Params = {
  readonly rootRef: RefObject<HTMLElement | null>;
  readonly selectedAgentId: AgentId | null;
  readonly rows: ReadonlyArray<SpawnedRow>;
  readonly shown: ReadonlyArray<FoldedSpawnedRow>;
  readonly onExpand: (ids: ReadonlyArray<string>) => void;
};

export const useSpawnedReveal = ({
  rootRef,
  selectedAgentId,
  rows,
  shown,
  onExpand,
}: Params): void => {
  const revealedRef = useRef<AgentId | null>(null);
  const hasRevealedRef = useRef(false);
  useEffect(() => {
    if (selectedAgentId === null || revealedRef.current === selectedAgentId) {
      return;
    }
    const ancestors = foldAncestorsOf({ rows, agentId: selectedAgentId });
    if (ancestors === null) {
      return;
    }
    const isShown = shown.some(({ row }) => row.agentId === selectedAgentId);
    if (!isShown) {
      onExpand(ancestors);
      return;
    }
    const element = [
      ...(rootRef.current?.querySelectorAll<HTMLElement>('[data-agent-id]') ?? []),
    ].find((item) => item.dataset.agentId === selectedAgentId);
    if (element === undefined) {
      return;
    }
    revealedRef.current = selectedAgentId;
    element.scrollIntoView({ block: hasRevealedRef.current ? 'nearest' : 'center' });
    hasRevealedRef.current = true;
  }, [rootRef, selectedAgentId, rows, shown, onExpand]);
};
