import { useLayoutEffect, useRef, useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { PANE_RHYTHM, cn } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { selectBrowserTabCount } from '../../../../store/slices/browser/selectBrowserTabCount';
import { selectDetailDrawer } from '../../../../store/slices/drawer/selectDetailDrawer';
import { selectDockDrawer } from '../../../../store/slices/drawer/selectDockDrawer';
import { selectSlotBack } from '../../../../store/slices/drawer/selectSlotBack';
import { monitoringSignalOf } from '../../../monitoring/monitoringSignalOf';
import { runningTerminalCount } from '../../../terminal/runningTerminalCount';
import { portsFactOf } from './portsFactOf';
import { SESSION_TOOL_RAIL_WIDTH } from './sessionToolRailWidth';
import { RAIL_TOOLS, type RailToolId } from './sessionTools';
import { SessionToolButton } from './SessionToolButton';
import { railFocusMemo } from './railFocusMemo';
import { toggleRailTool } from './toggleRailTool';
import { toolbarIndexAfter } from './toolbarIndexAfter';
import { toolFactOf } from './toolFactOf';
import { toolCountOf } from './toolCountOf';
import type { ToolSignal } from './ToolSignal';

type Props = {
  readonly sessionId: SessionId | null;
  readonly terminalSignal: ToolSignal | null;
};

type IndexParams = {
  readonly index: number;
};

const isFocusOnBody = (): boolean =>
  document.activeElement === null || document.activeElement === document.body;

export const ToolRailFrame = ({ sessionId, terminalSignal }: Props) => {
  const dockKind = useAppStore((state) => selectDockDrawer({ state })?.kind ?? null);
  const detailKind = useAppStore((state) =>
    state.appStudio === null ? (selectDetailDrawer({ state })?.kind ?? null) : null,
  );
  const pageKind = useAppStore((state) => state.appStudio?.kind ?? null);
  const waitingKind = useAppStore((state) => selectSlotBack({ state })?.kind ?? null);
  const runningCount = useAppStore((state) => runningTerminalCount({ tabs: state.terminalTabs }));
  const workspaceId = useAppStore((state) => state.currentWorkspaceId);
  const tabCount = useAppStore((state) => selectBrowserTabCount({ state, workspaceId }));
  const portsFact = useAppStore((state) =>
    portsFactOf({ monitoring: monitoringSignalOf({ state }) }),
  );
  const portsInUse = useAppStore((state) => monitoringSignalOf({ state })?.inUse ?? 0);
  const hasDownPin = useAppStore(
    (state) => (monitoringSignalOf({ state })?.downPins.length ?? 0) > 0,
  );
  const tools = RAIL_TOOLS;
  const count = tools.length;
  const [focusIndex, setFocusIndex] = useState(() =>
    Math.max(
      0,
      tools.findIndex((tool) => tool.pane === railFocusMemo.pane),
    ),
  );
  const activeIndex = Math.min(focusIndex, count - 1);
  const railRef = useRef<HTMLDivElement | null>(null);
  const activePaneRef = useRef<RailToolId | null>(null);
  activePaneRef.current = tools[activeIndex]?.pane ?? null;
  useLayoutEffect(() => {
    const rail = railRef.current;
    const isOnDrawerEdge = rail !== null && rail.closest('[data-drawer-edge]') !== null;
    if (railFocusMemo.hasFocus) {
      railFocusMemo.hasFocus = false;
      rail
        ?.querySelector<HTMLButtonElement>(`[data-testid="pane-toggle-${activePaneRef.current}"]`)
        ?.focus();
    }
    return () => {
      railFocusMemo.pane = activePaneRef.current;
      const isReturnFromDrawer = isOnDrawerEdge && railFocusMemo.isDrawerOpener && isFocusOnBody();
      railFocusMemo.hasFocus =
        (rail !== null && rail.contains(document.activeElement)) || isReturnFromDrawer;
      if (isReturnFromDrawer) {
        railFocusMemo.isDrawerOpener = false;
      }
      queueMicrotask(() => {
        railFocusMemo.hasFocus = false;
      });
    };
  }, []);
  const rovingOf = ({ index }: IndexParams) => ({
    tabIndex: index === activeIndex ? 0 : -1,
    onFocus: () => {
      railFocusMemo.pane = tools[index]?.pane ?? null;
      setFocusIndex(index);
    },
  });
  return (
    <div
      ref={railRef}
      style={{ width: SESSION_TOOL_RAIL_WIDTH }}
      role="toolbar"
      aria-label="Tools"
      aria-orientation="vertical"
      data-testid="session-tools"
      onFocus={() => {
        railFocusMemo.isDrawerOpener = false;
      }}
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (next instanceof Element && next.closest('[data-drawer-card]') !== null) {
          railFocusMemo.isDrawerOpener = true;
        }
      }}
      onKeyDown={(event) => {
        const next = toolbarIndexAfter({ key: event.key, from: activeIndex, count });
        if (next === null) {
          return;
        }
        event.preventDefault();
        setFocusIndex(next);
        event.currentTarget.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
      }}
      className={cn(
        'flex h-full shrink-0 flex-col items-center gap-2 px-0.5 pb-3',
        PANE_RHYTHM.headerInset,
      )}
    >
      {tools.map((tool, index) => {
        const isSessionMissing = tool.isSessionOnly && sessionId === null;
        return (
          <SessionToolButton
            key={tool.pane}
            tool={tool}
            isOpen={dockKind === tool.pane || detailKind === tool.pane}
            isWaiting={waitingKind === tool.pane}
            isCurrent={pageKind === tool.pane}
            isDisabled={isSessionMissing}
            fact={toolFactOf({
              pane: tool.pane,
              runningCount,
              tabCount,
              portsFact,
              isSessionMissing,
            })}
            count={toolCountOf({ pane: tool.pane, portsInUse, hasDownPin })}
            signal={tool.pane === 'terminal' ? terminalSignal : null}
            {...rovingOf({ index })}
            onToggle={() => toggleRailTool({ pane: tool.pane, sessionId })}
          />
        );
      })}
    </div>
  );
};
