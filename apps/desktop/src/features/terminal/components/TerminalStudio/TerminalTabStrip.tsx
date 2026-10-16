import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { Plus } from 'lucide-react';
import { IconButton, ScrollFade } from '@goodboy/ui';
import { useTerminalPorts } from '../../../monitoring/useTerminalPorts';
import type { TerminalTab } from '../../../../shared/types/terminal';
import { isOverlayOpen } from '../../../../shared/keyboard/isOverlayOpen';
import { useShortcut } from '../../../../shared/keyboard/useShortcut';
import { PortChip } from '../PortChip';
import { TerminalTabItem } from './TerminalTabItem';

type RenameParams = {
  readonly tab: TerminalTab;
  readonly title: string;
};

type Props = {
  readonly label: string;
  readonly tabs: ReadonlyArray<TerminalTab>;
  readonly selectedId: string | null;
  readonly busyIds: ReadonlySet<string>;
  readonly commandOf: (tab: TerminalTab) => string | null;
  readonly onSelect: (tab: TerminalTab) => void;
  readonly onClose: (tab: TerminalTab) => void;
  readonly onRestart: (tab: TerminalTab) => void;
  readonly onRename: (params: RenameParams) => Promise<void>;
  readonly onNew: () => void;
  readonly isShortcutEnabled?: boolean;
};

const NO_PORTS: ReadonlyArray<number> = [];

export const TerminalTabStrip = ({
  label,
  tabs,
  selectedId,
  busyIds,
  commandOf,
  onSelect,
  onClose,
  onRestart,
  onRename,
  onNew,
  isShortcutEnabled = true,
}: Props) => {
  const portsByTerminal = useTerminalPorts();
  const listRef = useRef<HTMLDivElement | null>(null);
  const stripId = useId();
  const [armedId, setArmedId] = useState<string | null>(null);
  const selectedPorts =
    (selectedId === null ? undefined : portsByTerminal.get(selectedId)) ?? NO_PORTS;
  const domIdOf = (tab: TerminalTab): string => `${stripId}-${tab.id}`;

  useShortcut(
    'terminal.closeTab',
    () => {
      if (isOverlayOpen({})) {
        return false;
      }
      const tab = tabs.find((candidate) => candidate.id === selectedId);
      if (tab === undefined) {
        return false;
      }
      if (tab.status !== 'exited' && busyIds.has(tab.id)) {
        setArmedId(tab.id);
        return;
      }
      onClose(tab);
    },
    isShortcutEnabled,
    { canDecline: true },
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }
    if (!(event.target instanceof HTMLElement) || event.target.getAttribute('role') !== 'tab') {
      return;
    }
    const index = tabs.findIndex((tab) => tab.id === selectedId);
    if (index < 0 || tabs.length < 2) {
      return;
    }
    event.preventDefault();
    const step = event.key === 'ArrowRight' ? 1 : tabs.length - 1;
    const next = tabs[(index + step) % tabs.length];
    if (next === undefined) {
      return;
    }
    onSelect(next);
    window.requestAnimationFrame(() => {
      listRef.current
        ?.querySelector<HTMLElement>(`[data-terminal-tab="${next.id}"] [role="tab"]`)
        ?.focus();
    });
  };

  return (
    <div className="flex shrink-0 items-center gap-0.5 px-3">
      <ScrollFade
        orientation="horizontal"
        className="min-w-0 shrink"
        viewportClassName="flex items-center"
      >
        <div ref={listRef} onKeyDown={handleKeyDown} className="flex items-center gap-0.5">
          <div
            role="tablist"
            aria-label={`Terminals on ${label}`}
            aria-owns={tabs.map(domIdOf).join(' ')}
            className="sr-only"
          />
          {tabs.map((tab) => (
            <TerminalTabItem
              key={tab.id}
              tab={tab}
              domId={domIdOf(tab)}
              isSelected={tab.id === selectedId}
              isBusy={busyIds.has(tab.id)}
              command={commandOf(tab)}
              isArmed={armedId === tab.id}
              onSelect={() => onSelect(tab)}
              onArm={() => setArmedId(tab.id)}
              onDisarm={() => setArmedId(null)}
              onClose={() => onClose(tab)}
              onRestart={() => onRestart(tab)}
              onRename={(title) => onRename({ tab, title })}
            />
          ))}
        </div>
      </ScrollFade>
      <IconButton
        icon={Plus}
        label={`New tab on ${label}`}
        tooltip="New tab on this worktree"
        size="sm"
        onClick={onNew}
      />
      <span className="flex-1" />
      <div className="flex shrink-0 items-center gap-1">
        {selectedPorts.map((port) => (
          <PortChip key={port} port={port} />
        ))}
      </div>
    </div>
  );
};
