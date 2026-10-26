import { useMemo } from 'react';
import { useAppStore } from '../../../../store';
import { selectPortRows } from '../../../../store/slices/monitoring/selectPortRows';
import { monitoringSignal } from '../../../../features/monitoring/monitoringSignal';
import { splitPortRows } from '../../../../features/monitoring/splitPortRows';
import { workspacePortSet } from '../../../../features/monitoring/workspacePortSet';
import { useChatActivity } from '../../../../features/workspace-chat/hooks/useChatActivity';
import { runningTerminalCount } from '../../../../features/terminal/runningTerminalCount';
import { useNowSessions } from '../../../../shared/hooks/useNowSessions';
import type { ColumnDoorId } from '../columnPlace';
import { doorSignalOf, type DoorSignal } from '../doorSignal';

type Params = Record<never, never>;

export const useDoorSignals = ({}: Params): Partial<Record<ColumnDoorId, DoorSignal>> => {
  const terminalTabs = useAppStore((state) => state.terminalTabs);
  const rows = useAppStore(selectPortRows);
  const hasSnapshot = useAppStore((state) => state.monitorSnapshot !== null);
  const scanned = useAppStore((state) => state.monitorScanned);
  const pinned = useAppStore((state) => state.monitorPinned);
  const hidden = useAppStore((state) => state.monitorHidden);
  const { runningCount, hasUnread } = useChatActivity();
  const taskNewCount = useAppStore((state) =>
    state.currentWorkspaceId === null
      ? 0
      : (state.taskNewKeys[state.currentWorkspaceId]?.length ?? 0),
  );
  const { attention } = useNowSessions({});

  return useMemo(() => {
    const split = splitPortRows({
      rows,
      pinned,
      hidden,
      workspacePorts: workspacePortSet({ scanned }),
    });
    return {
      board: doorSignalOf({
        kind: 'board',
        count: attention.count,
        tone: attention.tone,
        reasons: attention.reasons,
        quietCount: attention.quietCount,
        quietReasons: attention.quietReasons,
      }),
      inbox: doorSignalOf({ kind: 'inbox', count: taskNewCount }),
      chat: doorSignalOf({ kind: 'chat', count: runningCount, hasUnread }),
      terminal: doorSignalOf({
        kind: 'terminal',
        count: runningTerminalCount({ tabs: terminalTabs }),
      }),
      monitoring: hasSnapshot
        ? doorSignalOf({ kind: 'monitoring', ...monitoringSignal({ split }) })
        : undefined,
    };
  }, [
    attention,
    taskNewCount,
    runningCount,
    hasUnread,
    terminalTabs,
    rows,
    hasSnapshot,
    scanned,
    pinned,
    hidden,
  ]);
};
