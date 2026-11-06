import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../../../store';
import type { AppState } from '../../../../store/types';
import { HistoryArrow } from './HistoryArrow';
import type { HistoryItem } from './historyItem';
import { historyLabel, type HistoryLabel } from './historyLabel';

const HISTORY_MENU_LIMIT = 12;

type LabelsParams = {
  readonly state: AppState;
};

const labelsOf = ({ state }: LabelsParams): ReadonlyArray<HistoryLabel> =>
  (state.navigation[state.currentWorkspaceId ?? '']?.entries ?? []).map((location) =>
    historyLabel({ location, state }),
  );

export const NavCluster = () => {
  const stack = useAppStore((s) => s.navigation[s.currentWorkspaceId ?? ''] ?? null);
  const titles = useAppStore(useShallow((s) => labelsOf({ state: s }).map((label) => label.label)));
  const contexts = useAppStore(
    useShallow((s) => labelsOf({ state: s }).map((label) => label.context)),
  );
  const back = useAppStore((s) => s.back);
  const forward = useAppStore((s) => s.forward);
  const goToHistory = useAppStore((s) => s.goToHistory);

  const { backTarget, forwardTarget, items } = useMemo(() => {
    if (stack === null) {
      return { backTarget: null, forwardTarget: null, items: [] as ReadonlyArray<HistoryItem> };
    }
    const labelAt = (index: number): HistoryLabel | null => {
      const label = titles[index];
      return label === undefined ? null : { label, context: contexts[index] ?? null };
    };
    const all = titles.map((label, index): HistoryItem => ({
      label,
      context: contexts[index] ?? null,
      index,
      isCurrent: index === stack.index,
    }));
    return {
      backTarget: labelAt(stack.index - 1),
      forwardTarget: labelAt(stack.index + 1),
      items: [...all].reverse().slice(0, HISTORY_MENU_LIMIT),
    };
  }, [stack, titles, contexts]);

  return (
    <div data-nav-cluster="" className="flex shrink-0 items-center gap-0.5">
      <HistoryArrow
        direction="back"
        target={backTarget}
        items={items}
        onGo={back}
        onJump={(index) => goToHistory({ index })}
      />
      <HistoryArrow
        direction="forward"
        target={forwardTarget}
        items={items}
        onGo={forward}
        onJump={(index) => goToHistory({ index })}
      />
    </div>
  );
};
