import { useCallback, useLayoutEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { HistoryStep } from '@goodboy/types';
import { moveBy, type CombineMode } from '../../../historyPlan';
import type { HistoryHover } from '../useHistoryFocus';
import type { useHistoryEditing } from '../useHistoryEditing';
import type { useHistoryPlanDrag } from '../useHistoryPlanDrag';

type Latest = {
  readonly items: ReadonlyArray<HistoryStep>;
  readonly titleOf: (sha: string) => string;
  readonly drag: ReturnType<typeof useHistoryPlanDrag>;
  readonly editing: ReturnType<typeof useHistoryEditing>;
  readonly setEditingSha: (sha: string | null) => void;
  readonly setHover: (hover: HistoryHover | null) => void;
  readonly toggleExpanded: (sha: string) => void;
};

type HistoryRowCallbacks = {
  readonly onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  readonly onHover: (isOver: boolean) => void;
  readonly onSeparate: (sha: string) => void;
  readonly onModeChange: (sha: string, mode: CombineMode) => void;
  readonly onToggleExpanded: () => void;
  readonly onRename: () => void;
  readonly onFoldDown: () => void;
  readonly onSquashDown: () => void;
  readonly onToggleRemove: () => void;
  readonly onSeparateSelf: () => void;
  readonly onMove: (direction: 'newer' | 'older') => void;
};

export type HistoryRowCallbacksFor = (params: { readonly sha: string }) => HistoryRowCallbacks;

export const useHistoryRowCallbacks = ({
  latest,
}: {
  readonly latest: Latest;
}): HistoryRowCallbacksFor => {
  const current = useRef(latest);
  const cache = useRef(new Map<string, HistoryRowCallbacks>());

  useLayoutEffect(() => {
    current.current = latest;
  });

  return useCallback(({ sha }: { readonly sha: string }) => {
    const known = cache.current.get(sha);
    if (known !== undefined) {
      return known;
    }
    const made: HistoryRowCallbacks = {
      onPointerDown: (event) => current.current.drag.onPointerDown(event, sha),
      onHover: (isOver) => {
        if (current.current.drag.drag !== null) {
          return;
        }
        current.current.setHover(isOver ? { kind: 'row', sha } : null);
      },
      onSeparate: (target) => current.current.editing.separate({ sha: target }),
      onModeChange: (target, mode) => current.current.editing.setMode({ sha: target, mode }),
      onToggleExpanded: () => current.current.toggleExpanded(sha),
      onRename: () => current.current.setEditingSha(sha),
      onFoldDown: () => current.current.editing.foldDown({ sha, mode: 'fixup' }),
      onSquashDown: () => current.current.editing.foldDown({ sha, mode: 'squash' }),
      onToggleRemove: () => current.current.editing.toggleRemove({ sha }),
      onSeparateSelf: () => current.current.editing.separate({ sha }),
      onMove: (direction) => {
        const { items, titleOf, editing } = current.current;
        editing.change({
          items: moveBy({ items, sha, direction }),
          arrive: { sha, action: 'move' },
          message: `Moved ${titleOf(sha)}`,
        });
      },
    };
    cache.current.set(sha, made);
    return made;
  }, []);
};
