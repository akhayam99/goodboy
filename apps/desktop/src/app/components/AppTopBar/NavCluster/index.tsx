import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../../../store';
import { useChatActivity } from '../../../../features/workspace-chat/hooks/useChatActivity';
import { selectIsSessionDraftShown } from '../../../../store/slices/sessionDraft/selectIsSessionDraftShown';
import { useGoToBoard } from '../../../hooks/useGoToBoard';
import { BoardButton } from './BoardButton';
import { ChatButton } from './ChatButton';
import { HistoryArrow } from './HistoryArrow';
import type { HistoryItem } from './HistoryMenu';
import { historyLabel } from './historyLabel';

const HISTORY_MENU_LIMIT = 12;

type Props = {
  readonly hasDoors?: boolean;
};

export const NavCluster = ({ hasDoors = false }: Props) => {
  const stack = useAppStore((s) => s.navigation[s.currentWorkspaceId ?? ''] ?? null);
  const sessions = useAppStore(
    useShallow((s) => {
      const stored = s.navigation[s.currentWorkspaceId ?? ''];
      if (stored === undefined) {
        return [];
      }
      const ids = new Set(
        stored.entries.flatMap((location) =>
          location.studio === null && location.place.at === 'session'
            ? [location.place.sessionId]
            : [],
        ),
      );
      return s.sessions.filter((session) => ids.has(session.id));
    }),
  );
  const isOnBoard = useAppStore(
    (s) => s.currentSessionId === null && !selectIsSessionDraftShown({ state: s }),
  );
  const studioKind = useAppStore((s) => s.appStudio?.kind ?? null);
  const hasWorkspace = useAppStore((s) => s.currentWorkspaceId !== null);
  const switchStudio = useAppStore((s) => s.switchStudio);
  const back = useAppStore((s) => s.back);
  const forward = useAppStore((s) => s.forward);
  const goToHistory = useAppStore((s) => s.goToHistory);
  const goToBoard = useGoToBoard();
  const chatActivity = useChatActivity();

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
      {hasDoors ? (
        <BoardButton isOnBoard={isOnBoard} hasStudio={studioKind !== null} onBoard={goToBoard} />
      ) : null}
      {hasDoors && hasWorkspace ? (
        <ChatButton
          isOnChat={studioKind === 'chat'}
          runningCount={chatActivity.runningCount}
          hasUnread={chatActivity.hasUnread}
          onChat={() => switchStudio({ studio: { kind: 'chat', chatId: null } })}
        />
      ) : null}
    </div>
  );
};
