import { useCallback, useEffect, useMemo } from 'react';
import { Button, Divider, EmptyState } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { PaneShell } from '../../../session/components/SessionWorkspace/parts/PaneShell';
import {
  GenericTerminalPanel,
  type TerminalDriver,
} from '../../../../shared/components/GenericTerminalPanel';
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

  if (tabs.length === 0) {
    return (
      <PaneShell title="Terminal" description="Run commands in this session's worktree.">
        <EmptyState
          bordered
          tone="info"
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
    <div className="flex min-h-0 flex-1 flex-col">
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
