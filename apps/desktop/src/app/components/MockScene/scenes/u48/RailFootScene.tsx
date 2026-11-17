import { useEffect, useState } from 'react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { useAppStore } from '../../../../../store';
import type { AppState } from '../../../../../store/types';
import { shellArrangement } from '../../../../shellArrangement';
import type { ColumnActions } from '../../../SideColumn/columnDoors';
import { ShellLeft } from '../../../SideColumn/ShellLeft';
import { installSceneDatabase } from '../sceneDatabase';

export type RailFootKind =
  'rest' | 'available' | 'downloading' | 'ready' | 'running' | 'queued' | 'failed';

type Props = {
  readonly kind: RailFootKind;
  readonly isCardOpen: boolean;
};

type SeedParams = {
  readonly kind: RailFootKind;
};

type TurnsParams = {
  readonly json: string;
};

const VERSION = '0.40.1';
const CLICK_DELAY_MS = 250;
const STARTED_AT = '2026-11-17T09:12:00.000Z';
const ARRANGEMENT = shellArrangement({ hasWorkspace: false, isSidebarCollapsed: false });

const noop = () => undefined;

const ACTIONS: ColumnActions = {
  openBoard: noop,
  openInbox: noop,
  openChat: noop,
  openWorkflows: noop,
  openNewChat: noop,
  openConnections: noop,
  openMonitoring: noop,
  openImpact: noop,
  openSettings: noop,
  openChangelog: noop,
  openGuide: noop,
};

const turnsOf = ({ json }: TurnsParams): AppState['agentTurnState'] => JSON.parse(json);

const TWO_RUNNING = turnsOf({
  json: JSON.stringify({
    'agent-0': { kind: 'running', runId: 'run-0', startedAt: STARTED_AT },
    'agent-1': { kind: 'running', runId: 'run-1', startedAt: STARTED_AT },
  }),
});

const seedOf = ({ kind }: SeedParams): Partial<AppState> => {
  const base: Partial<AppState> = {
    updateVersion: VERSION,
    updateNotes: null,
    updateFailure: null,
    updateProgress: null,
    updateQueuedUntilIdle: false,
    agentTurnState: turnsOf({ json: '{}' }),
  };
  switch (kind) {
    case 'rest':
      return { ...base, updaterStatus: 'idle', updateVersion: null };
    case 'available':
      return { ...base, updaterStatus: 'available' };
    case 'downloading':
      return {
        ...base,
        updaterStatus: 'downloading-bg',
        updateProgress: { downloaded: 42, total: 100 },
      };
    case 'ready':
      return { ...base, updaterStatus: 'ready' };
    case 'running':
      return { ...base, updaterStatus: 'ready', agentTurnState: TWO_RUNNING };
    case 'queued':
      return {
        ...base,
        updaterStatus: 'ready',
        updateQueuedUntilIdle: true,
        agentTurnState: TWO_RUNNING,
      };
    case 'failed':
      return {
        ...base,
        updaterStatus: 'ready',
        updateFailure: { phase: 'install', message: 'There is not enough space on this Mac.' },
      };
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
};

export const RailFootScene = ({ kind, isCardOpen }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    installSceneDatabase();
    useAppStore.setState(seedOf({ kind }));
    setIsReady(true);
  }, [kind]);

  useEffect(() => {
    if (!isReady || !isCardOpen) {
      return;
    }
    const timer = window.setInterval(() => {
      if (document.querySelector('[role="dialog"]') !== null) {
        window.clearInterval(timer);
        return;
      }
      const mark = document.querySelector<HTMLElement>('[data-shell-rail-item="update"]');
      if (mark === null) {
        return;
      }
      mark.click();
      window.clearInterval(timer);
    }, CLICK_DELAY_MS);
    return () => window.clearInterval(timer);
  }, [isReady, isCardOpen]);

  if (!isReady) {
    return null;
  }

  return (
    <ToastProvider>
      <main className="flex h-screen bg-background text-foreground">
        <ShellLeft arrangement={ARRANGEMENT} workspaceId={null} actions={ACTIONS} />
        <h1 className="sr-only">Rail foot, {kind}</h1>
      </main>
    </ToastProvider>
  );
};
