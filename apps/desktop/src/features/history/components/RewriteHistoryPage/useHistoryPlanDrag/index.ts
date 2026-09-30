import type { RefObject } from 'react';
import type { HistoryStep } from '@goodboy/types';
import {
  canCombine,
  combineInto,
  isFolded,
  moveAbove,
  slotAnchorIsNoop,
} from '../../../historyPlan';
import { useHistoryDrag } from '../../../useHistoryDrag';
import type { HistoryChange } from '../useHistoryEditing';

type Params = {
  readonly listRef: RefObject<HTMLElement | null>;
  readonly isEnabled: boolean;
  readonly items: ReadonlyArray<HistoryStep>;
  readonly titleOf: (sha: string) => string;
  readonly change: HistoryChange;
  readonly clearHover: () => void;
  readonly setLive: (message: string) => void;
};

export const useHistoryPlanDrag = ({
  listRef,
  isEnabled,
  items,
  titleOf,
  change,
  clearHover,
  setLive,
}: Params) =>
  useHistoryDrag({
    listRef,
    isEnabled,
    canDrag: (sha) => {
      const step = items.find((candidate) => candidate.sha === sha);
      return step !== undefined && !isFolded({ step });
    },
    isAnchor: (sha) => {
      const step = items.find((candidate) => candidate.sha === sha);
      return step !== undefined && !isFolded({ step });
    },
    canDropInto: ({ sha, target }) => canCombine({ items, sha, target }),
    isNoopSlot: ({ sha, anchor }) => slotAnchorIsNoop({ items, sha, anchor }),
    onMove: ({ sha, anchor }) =>
      change({
        items: moveAbove({ items, sha, anchor }),
        arrive: { sha, action: 'move' },
        message: `Moved ${titleOf(sha)}`,
      }),
    onCombine: ({ sha, target }) =>
      change({
        items: combineInto({ items, sha, target, mode: 'fixup' }),
        arrive: { sha: target, action: 'fixup' },
        message: `Folded ${titleOf(sha)} into ${titleOf(target)}, keeping its title`,
      }),
    onPickUp: (sha) => {
      clearHover();
      setLive(`Picked up ${titleOf(sha)}`);
    },
    onCancel: () => setLive('Cancelled'),
  });
