import { useEffect, useState } from 'react';
import { LEFT_SIDEBAR_DEFAULT, LEFT_SIDEBAR_MIN, LEFT_SIDEBAR_STORAGE_KEY } from '@goodboy/ui';
import { toggleUpdateCard } from '../../../../../features/updater/updateCardRequest';
import type { UpdateFailure, UpdaterState } from '../../../../../store/slices/updater/state';
import type { AppState } from '../../../../../store/types';
import { sceneClock } from '../../sceneClock';
import { useAppStore } from '../../../../../store';
import { SettingsFrame } from '../audit/SettingsFrame';
import { sceneParam } from '../audit/sceneParams';
import { seedImpactScene } from '../ImpactScene';
import { installSceneDatabase } from '../sceneDatabase';
import { StudioFrame } from '../StudioFrame';

const VERSION = '0.27.2';
const OPEN_MS = 300;
const STARTED_AT = '2026-10-17T09:12:00.000Z';
const CLOCK = sceneClock({ anchor: '2026-10-17T09:15:00.000Z' });

type Variant = 'available' | 'ready' | 'running' | 'failed' | 'row';

type Seed = {
  readonly status: UpdaterState['updaterStatus'];
  readonly failure: UpdateFailure | null;
  readonly runningCount: number;
};

const SEEDS: Readonly<Record<Variant, Seed>> = {
  available: { status: 'available', failure: null, runningCount: 0 },
  ready: { status: 'ready', failure: null, runningCount: 0 },
  running: { status: 'ready', failure: null, runningCount: 2 },
  failed: {
    status: 'available',
    failure: { phase: 'download', message: 'The download was cut off at 61%.' },
    runningCount: 0,
  },
  row: { status: 'available', failure: null, runningCount: 0 },
};

const SHOULD_OPEN: Readonly<Record<Variant, boolean>> = {
  available: true,
  ready: false,
  running: false,
  failed: false,
  row: false,
};

type RunningParams = {
  readonly count: number;
};

const runningTurns = ({ count }: RunningParams): AppState['agentTurnState'] =>
  JSON.parse(
    JSON.stringify(
      Object.fromEntries(
        Array.from({ length: count }, (_, index) => [
          `mock-update-agent-${index + 1}`,
          { kind: 'running', runId: `mock-update-run-${index + 1}`, startedAt: STARTED_AT },
        ]),
      ),
    ),
  );

const noop = async (): Promise<void> => undefined;

type SeedParams = {
  readonly seed: Seed;
};

const seedUpdate = ({ seed }: SeedParams): void => {
  useAppStore.setState({
    updaterStatus: seed.status,
    updateVersion: VERSION,
    updateNotes: null,
    updateFailure: seed.failure,
    updateCheckedAt: CLOCK.iso({ at: STARTED_AT }),
    updateQueuedUntilIdle: false,
    agentTurnState: runningTurns({ count: seed.runningCount }),
    applyUpdate: noop,
    downloadUpdate: noop,
    checkForUpdates: noop,
  });
};

const sidebarWidth = (): number => {
  const asked = Number.parseInt(sceneParam({ key: 'sidebar' }) ?? '', 10);
  return Number.isNaN(asked) ? LEFT_SIDEBAR_MIN : asked;
};

type FrameProps = {
  readonly variant: Variant;
};

const UpdateFrame = ({ variant }: FrameProps) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(
      LEFT_SIDEBAR_STORAGE_KEY,
      String(variant === 'row' ? sidebarWidth() : LEFT_SIDEBAR_DEFAULT),
    );
    installSceneDatabase();
    seedImpactScene();
    seedUpdate({ seed: SEEDS[variant] });
    setIsReady(true);
  }, [variant]);

  useEffect(() => {
    if (!isReady || !SHOULD_OPEN[variant]) {
      return;
    }
    const timer = window.setTimeout(toggleUpdateCard, OPEN_MS);
    return () => window.clearTimeout(timer);
  }, [isReady, variant]);

  if (!isReady) {
    return null;
  }

  return (
    <StudioFrame
      target={{ place: null, tool: null }}
      columnPlace={null}
      main={<div className="h-full bg-background" />}
    />
  );
};

const seedSettingsReady = (): void => {
  seedUpdate({ seed: SEEDS.running });
};

export const U26S_UPDATE_CARD_SCENES = {
  'u26s-update-available': () => <UpdateFrame variant="available" />,
  'u26s-update-ready': () => <UpdateFrame variant="ready" />,
  'u26s-update-running': () => <UpdateFrame variant="running" />,
  'u26s-update-failed': () => <UpdateFrame variant="failed" />,
  'u26s-update-row': () => <UpdateFrame variant="row" />,
  'u26s-update-settings': () => (
    <SettingsFrame focus={{ scope: 'app', section: 'updates' }} seed={seedSettingsReady} />
  ),
};
