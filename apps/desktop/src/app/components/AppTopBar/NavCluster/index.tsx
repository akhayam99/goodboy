import { useMemo } from 'react';
import { useAppStore } from '../../../../store';
import { useGoToBoard } from '../../../hooks/useGoToBoard';
import { STUDIO_META } from '../../StudioFrame/studioMeta';
import { BoardButton } from './BoardButton';
import { HistoryArrow } from './HistoryArrow';
import type { HistoryItem } from './HistoryMenu';
import { historyLabel } from './historyLabel';

const HISTORY_MENU_LIMIT = 12;

export const NavCluster = () => {
  const stack = useAppStore((s) => s.navigation[s.currentWorkspaceId ?? ''] ?? null);
  const sessions = useAppStore((s) => s.sessions);
  const isOnBoard = useAppStore((s) => s.currentSessionId === null);
  const studioKind = useAppStore((s) => s.appStudio?.kind ?? null);
  const back = useAppStore((s) => s.back);
  const forward = useAppStore((s) => s.forward);
  const goToHistory = useAppStore((s) => s.goToHistory);
  const goToBoard = useGoToBoard();

  const { backTarget, forwardTarget, items } = useMemo(() => {
    if (stack === null) {
      return { backTarget: null, forwardTarget: null, items: [] as ReadonlyArray<HistoryItem> };
    }
    const labelAt = (index: number) => {
      const location = stack.entries[index];
      return location === undefined ? null : historyLabel({ location, sessions });
    };
    const all = stack.entries.flatMap((location, index): ReadonlyArray<HistoryItem> => [
      { ...historyLabel({ location, sessions }), index, isCurrent: index === stack.index },
    ]);
    return {
      backTarget: labelAt(stack.index - 1),
      forwardTarget: labelAt(stack.index + 1),
      items: [...all].reverse().slice(0, HISTORY_MENU_LIMIT),
    };
  }, [stack, sessions]);

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
      <BoardButton
        isOnBoard={isOnBoard}
        studioTitle={studioKind === null ? null : STUDIO_META[studioKind].title}
        onBoard={goToBoard}
      />
    </div>
  );
};
