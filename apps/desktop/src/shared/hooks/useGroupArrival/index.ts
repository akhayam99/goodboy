import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../../store';
import { runGroupFocusOf } from '../../../store/slices/navigation/runGroupFocusOf';

export type ArrivalGroup = Readonly<{
  key: string;
  firstRowKey: string | null;
}>;

type ArriveParams = {
  readonly groupKey: string;
};

type Params = {
  readonly isActive: boolean;
  readonly rowAttribute: string;
  readonly groups: ReadonlyArray<ArrivalGroup>;
  readonly onArrive: (params: ArriveParams) => void;
};

type RevealParams = {
  readonly rowKey: string;
};

type Arrival = Readonly<{
  revealRow: (params: RevealParams) => void;
}>;

export const useGroupArrival = ({ isActive, rowAttribute, groups, onArrive }: Params): Arrival => {
  const arrivedGroupKey = useAppStore((state) => runGroupFocusOf({ state })?.groupKey ?? null);
  const revealedArrival = useRef<string | null>(null);
  const [revealRowKey, setRevealRowKey] = useState<string | null>(null);

  useEffect(() => {
    if (arrivedGroupKey === null) {
      revealedArrival.current = null;
      return;
    }
    if (!isActive || revealedArrival.current === arrivedGroupKey) {
      return;
    }
    const group = groups.find((candidate) => candidate.key === arrivedGroupKey);
    if (group === undefined) {
      return;
    }
    revealedArrival.current = arrivedGroupKey;
    onArrive({ groupKey: arrivedGroupKey });
    setRevealRowKey(group.firstRowKey);
  }, [arrivedGroupKey, isActive, groups, onArrive]);

  useEffect(() => {
    if (revealRowKey === null) {
      return;
    }
    const row = document.querySelector<HTMLElement>(
      `[${rowAttribute}="${CSS.escape(revealRowKey)}"]`,
    );
    if (row === null) {
      return;
    }
    setRevealRowKey(null);
    row.scrollIntoView?.({ block: 'center' });
    row.focus();
  }, [revealRowKey, rowAttribute]);

  return { revealRow: ({ rowKey }) => setRevealRowKey(rowKey) };
};
