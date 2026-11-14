import { useLayoutEffect, useRef, useState } from 'react';
import { PANE_RHYTHM, cn } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { selectBrowserTabCount } from '../../../../store/slices/browser/selectBrowserTabCount';
import { selectBrowserTabCountState } from '../../../../store/slices/browser/selectBrowserTabCountState';
import { selectDrawerPanel } from '../../../../store/slices/drawer/selectDrawerPanel';
import { selectSlotBack } from '../../../../store/slices/drawer/selectSlotBack';
import { toggleBrowserDock } from '../../../browser/toggleBrowserDock';
import { runningTerminalCount } from '../../../terminal/runningTerminalCount';
import { toggleTerminalDock } from '../../../terminal/toggleTerminalDock';
import type { ClusterPane } from '../../panes/clusterPane';
import { SESSION_TOOL_RAIL_WIDTH } from './sessionToolRailWidth';
import { RAIL_TOOLS, type SessionTool } from './sessionTools';
import { SessionToolButton } from './SessionToolButton';
import { railFocusMemo } from './railFocusMemo';
import { ToolGroupCaption } from './ToolGroupCaption';
import { toolbarIndexAfter } from './toolbarIndexAfter';
import { toolFactOf } from './toolFactOf';
import type { ToolSignal } from './ToolSignal';

type Props = {
  readonly terminalSignal: ToolSignal | null;
};

type IndexParams = {
  readonly index: number;
};

type ToggleParams = {
  readonly tool: SessionTool;
};

const isFocusOnBody = (): boolean =>
  document.activeElement === null || document.activeElement === document.body;

const toggleWorkspaceTool = ({ tool }: ToggleParams): void => {
  if (tool.pane === 'terminal') {
    toggleTerminalDock({ isToggle: true });
    return;
  }
  toggleBrowserDock({ isToggle: true });
};

export const ToolRailFrame = ({ terminalSignal }: Props) => {
  const dockKind = useAppStore((state) => selectDrawerPanel(state)?.kind ?? null);
  const pageKind = useAppStore((state) => state.appStudio?.kind ?? null);
  const waitingKind = useAppStore((state) => selectSlotBack({ state })?.kind ?? null);
  const runningCount = useAppStore((state) => runningTerminalCount({ tabs: state.terminalTabs }));
  const workspaceId = useAppStore((state) => state.currentWorkspaceId);
  const tabCount = useAppStore((state) => selectBrowserTabCount({ state, workspaceId }));
  const tabCountState = useAppStore((state) => selectBrowserTabCountState({ state, workspaceId }));
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
  const activePaneRef = useRef<ClusterPane | null>(null);
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
      <ToolGroupCaption />
      {tools.map((tool, index) => (
        <SessionToolButton
          key={tool.pane}
          tool={tool}
          isOpen={dockKind === tool.pane}
          isWaiting={waitingKind === tool.pane}
          isCurrent={pageKind === tool.pane}
          fact={toolFactOf({ pane: tool.pane, runningCount, tabCount })}
          count={tool.pane === 'terminal' ? runningCount : (tabCount ?? 0)}
          isCountLoading={tool.pane === 'browser' && tabCountState === 'loading'}
          signal={tool.pane === 'terminal' ? terminalSignal : null}
          {...rovingOf({ index })}
          onToggle={() => toggleWorkspaceTool({ tool })}
        />
      ))}
    </div>
  );
};
