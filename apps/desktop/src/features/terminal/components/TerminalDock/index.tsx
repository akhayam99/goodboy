import { useCallback, useEffect, useMemo, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Button, Divider } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { LensEmptyState } from '@goodboy/ui';
import { PaneShell } from '../../../../shared/components/PaneShell';
import {
  GenericTerminalPanel,
  type TerminalDriver,
} from '../../../../shared/components/GenericTerminalPanel';
import { currentPlatform } from '../../../../shared/platform';
import type { TerminalTabId } from '../../../../shared/types/terminal';
import {
  invokeTerminalOpen,
  invokeTerminalResize,
  invokeTerminalWrite,
  listenTerminalExit,
  listenTerminalOutput,
} from '../../terminal';
import { disposeTerminalPty } from '../../closeTab';
import { TerminalTabStrip } from '../TerminalTabStrip';

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function stringToBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

const EMPTY_TABS = [] as const;

type Props = {
  readonly sessionId: SessionId;
  readonly isActive: boolean;
  readonly cwd: string | null;
};

export const TerminalDock = ({ sessionId, isActive, cwd }: Props) => {
  const tabs = useAppStore((s) => s.terminalTabs[sessionId] ?? EMPTY_TABS);
  const activeId = useAppStore((s) => s.activeTerminalTab[sessionId] ?? null);
  const addTerminalTab = useAppStore((s) => s.addTerminalTab);
  const closeTerminalTab = useAppStore((s) => s.closeTerminalTab);
  const setActiveTerminalTab = useAppStore((s) => s.setActiveTerminalTab);
  const setTerminalTabStatus = useAppStore((s) => s.setTerminalTabStatus);

  const activeTab = useMemo(() => tabs.find((t) => t.id === activeId) ?? null, [tabs, activeId]);

  const driver = useMemo<TerminalDriver>(() => {
    const terminalId = activeId;
    return {
      write: (data: string) => {
        if (!terminalId) {
          return;
        }
        void invokeTerminalWrite(terminalId, stringToBase64(data));
      },
      resize: (cols: number, rows: number) => {
        if (!terminalId) {
          return;
        }
        void invokeTerminalResize(terminalId, cols, rows);
      },
      onOutput: (handler) =>
        listenTerminalOutput((payload) => {
          if (payload.sessionId !== terminalId) {
            return;
          }
          handler(base64ToBytes(payload.data));
        }),
      onExit: (handler) =>
        listenTerminalExit((payload) => {
          if (payload.sessionId !== terminalId) {
            return;
          }
          handler(payload.exitCode);
        }),
    };
  }, [activeId]);

  useEffect(() => {
    if (!activeTab) {
      return;
    }
    void invokeTerminalOpen(activeTab.id, activeTab.cwd, 100, 24);
  }, [activeTab]);

  const handleClose = useCallback(
    (id: TerminalTabId) => {
      disposeTerminalPty(id);
      closeTerminalTab(sessionId, id);
    },
    [sessionId, closeTerminalTab],
  );

  const handleExit = useCallback(
    (id: TerminalTabId) => () => {
      setTerminalTabStatus(sessionId, id, 'exited');
    },
    [sessionId, setTerminalTabStatus],
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (!isActive || event.code !== 'KeyT' || event.altKey) {
        return;
      }
      const onMac = currentPlatform() === 'darwin';
      const matches = onMac
        ? event.metaKey && !event.ctrlKey && !event.shiftKey
        : event.ctrlKey && event.shiftKey && !event.metaKey;
      if (!matches) {
        return;
      }
      event.preventDefault();
      addTerminalTab(sessionId, cwd);
    },
    [isActive, addTerminalTab, sessionId, cwd],
  );

  if (tabs.length === 0) {
    return (
      <PaneShell title="Terminal" description="Run commands in this session's worktree.">
        <LensEmptyState
          tone={CONCEPT_TONE.terminal}
          icon={CONCEPT_ICONS.terminal}
          title="No terminal"
          description="Open a terminal to run commands in this worktree."
          action={
            <Button size="sm" variant="secondary" onClick={() => addTerminalTab(sessionId, cwd)}>
              New terminal
            </Button>
          }
        />
      </PaneShell>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" onKeyDown={handleKeyDown}>
      <TerminalTabStrip
        tabs={tabs}
        activeId={activeId}
        onSelect={(id) => setActiveTerminalTab(sessionId, id)}
        onClose={handleClose}
        onSpawn={() => addTerminalTab(sessionId, cwd)}
      />
      <Divider />
      <div className="relative min-h-0 flex-1">
        {activeTab ? (
          <GenericTerminalPanel
            key={activeTab.id}
            terminalId={activeTab.id}
            driver={driver}
            isActive={isActive}
            onExit={handleExit(activeTab.id)}
          />
        ) : null}
      </div>
    </div>
  );
};
