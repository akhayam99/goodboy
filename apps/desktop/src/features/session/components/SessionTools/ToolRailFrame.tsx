import { useState } from 'react';
import { PANE_RHYTHM, cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectDrawerPanel } from '../../../../store/slices/drawer/selectDrawerPanel';
import { selectSlotBack } from '../../../../store/slices/drawer/selectSlotBack';
import { browserTabCount } from '../../../browser/browserTabCount';
import { toggleBrowserDock } from '../../../browser/toggleBrowserDock';
import { runningTerminalCount } from '../../../terminal/runningTerminalCount';
import { toggleTerminalDock } from '../../../terminal/toggleTerminalDock';
import type { ClusterPane } from '../../panes/clusterPane';
import { togglePane } from '../../panes/togglePane';
import { SESSION_TOOL_RAIL_WIDTH } from './sessionToolRailWidth';
import { SESSION_TOOLS, WORKSPACE_TOOLS, type SessionTool } from './sessionTools';
import { SessionToolButton } from './SessionToolButton';
import { ToolGroupCaption } from './ToolGroupCaption';
import { toolbarIndexAfter } from './toolbarIndexAfter';
import { toolFactOf } from './toolFactOf';
import type { ToolSignal } from './useToolSignal';

export type SessionToolsPart = {
  readonly sessionId: SessionId;
  readonly openPane: ClusterPane | null;
  readonly waitingPane: ClusterPane | null;
  readonly signalOf: Readonly<Partial<Record<ClusterPane, ToolSignal | null>>>;
};

type Props = {
  readonly session: SessionToolsPart | null;
  readonly terminalSignal: ToolSignal | null;
};

type IndexParams = {
  readonly index: number;
};

type ToggleParams = {
  readonly tool: SessionTool;
};

const toggleWorkspaceTool = ({ tool }: ToggleParams): void => {
  if (tool.pane === 'terminal') {
    toggleTerminalDock({ isToggle: true });
    return;
  }
  toggleBrowserDock({ isToggle: true });
};

export const ToolRailFrame = ({ session, terminalSignal }: Props) => {
  const dockKind = useAppStore((state) => selectDrawerPanel(state)?.kind ?? null);
  const pageKind = useAppStore((state) => state.appStudio?.kind ?? null);
  const waitingKind = useAppStore((state) => selectSlotBack({ state })?.kind ?? null);
  const runningCount = useAppStore((state) => runningTerminalCount({ tabs: state.terminalTabs }));
  const tabCount = useAppStore((state) => browserTabCount({ state }));
  const sessionTools = session === null ? [] : SESSION_TOOLS;
  const count = sessionTools.length + WORKSPACE_TOOLS.length;
  const [focusIndex, setFocusIndex] = useState(0);
  const activeIndex = Math.min(focusIndex, count - 1);
  const rovingOf = ({ index }: IndexParams) => ({
    tabIndex: index === activeIndex ? 0 : -1,
    onFocus: () => setFocusIndex(index),
  });
  return (
    <div
      style={{ width: SESSION_TOOL_RAIL_WIDTH }}
      role="toolbar"
      aria-label="Tools"
      aria-orientation="vertical"
      data-testid="session-tools"
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
        'flex h-full shrink-0 flex-col items-center gap-2 bg-background px-0.5',
        PANE_RHYTHM.headerInset,
      )}
    >
      {session === null ? null : <ToolGroupCaption group="session" />}
      {session === null
        ? null
        : sessionTools.map((tool, index) => (
            <SessionToolButton
              key={tool.pane}
              tool={tool}
              isOpen={session.openPane === tool.pane}
              isWaiting={session.waitingPane === tool.pane}
              signal={session.signalOf[tool.pane] ?? null}
              {...rovingOf({ index })}
              onToggle={() => togglePane({ sessionId: session.sessionId, pane: tool.pane })}
            />
          ))}
      <span aria-hidden data-slot="tool-groups-gap" className="min-h-0 flex-1" />
      {session === null ? null : (
        <span
          role="separator"
          aria-orientation="horizontal"
          data-testid="session-tools-separator"
          className="h-px w-5 shrink-0 bg-border-soft"
        />
      )}
      <ToolGroupCaption group="workspace" />
      {WORKSPACE_TOOLS.map((tool, offset) => (
        <SessionToolButton
          key={tool.pane}
          tool={tool}
          isOpen={dockKind === tool.pane}
          isWaiting={waitingKind === tool.pane}
          isCurrent={pageKind === tool.pane}
          fact={toolFactOf({ pane: tool.pane, runningCount, tabCount })}
          isBusy={tool.pane === 'terminal' && runningCount > 0}
          signal={tool.pane === 'terminal' ? terminalSignal : null}
          {...rovingOf({ index: sessionTools.length + offset })}
          onToggle={() => toggleWorkspaceTool({ tool })}
        />
      ))}
    </div>
  );
};
