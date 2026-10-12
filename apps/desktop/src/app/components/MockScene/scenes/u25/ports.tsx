import { useEffect, useState } from 'react';
import { MonitoringStudio } from '../../../../../features/monitoring/components/MonitoringStudio';
import { useAppStore } from '../../../../../store';
import { useSceneClicks } from '../audit/useSceneClicks';
import { PageSheet } from '../PageSheet';
import { installSceneDatabase } from '../sceneDatabase';
import {
  PROJECTS,
  SESSIONS,
  SESSION_ID,
  SESSION_MOUNTS,
  WORKSPACE,
  WORKSPACE_ID,
} from '../u24/monitoringSeed';
import {
  PORTS_LEARNED,
  PORTS_LEDGER,
  PORTS_SCANNED,
  PORTS_SETTINGS,
  PORTS_SNAPSHOT,
} from './portsSeed';

type Variant = 'layers' | 'popover' | 'rowmenu' | 'pinnedmenu' | 'listening' | 'hidden';

type Props = {
  readonly variant: Variant;
};

const NOOP = () => undefined;

const CLICK_MS = 300;

const BUTTON_CLICKS: Readonly<Record<Variant, ReadonlyArray<string>>> = {
  layers: [],
  popover: ['Pin a port'],
  rowmenu: ['Actions for :5002'],
  pinnedmenu: ['Actions for :9000'],
  listening: ['Listening on this Mac'],
  hidden: ['Actions for :5002'],
};

const ITEM_CLICKS: Readonly<Record<Variant, ReadonlyArray<string>>> = {
  layers: [],
  popover: [],
  rowmenu: [],
  pinnedmenu: [],
  listening: [],
  hidden: ['Hide'],
};

type AnswerParams = {
  readonly command: string;
  readonly payload: unknown;
};

const answerOf = ({ command, payload }: AnswerParams) => {
  if (command === 'monitor_snapshot') {
    return PORTS_SNAPSHOT;
  }
  if (command === 'process_ledger_list') {
    return PORTS_LEDGER;
  }
  if (command === 'monitor_watched_ports') {
    const root =
      typeof payload === 'object' && payload !== null && 'projectRoot' in payload
        ? String(payload.projectRoot)
        : '';
    const project = PROJECTS.find((item) => item.rootPath === root);
    return project === undefined ? [] : (PORTS_SCANNED[project.id] ?? []);
  }
  return null;
};

const PortsScene = ({ variant }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    installSceneDatabase({
      settings: PORTS_SETTINGS,
      fallback: (command, payload) => answerOf({ command, payload }),
    });
    useAppStore.setState({
      workspaces: [WORKSPACE],
      currentWorkspaceId: WORKSPACE_ID,
      projects: [...PROJECTS],
      sessions: [...SESSIONS],
      currentSessionId: SESSION_ID,
      sessionMounts: SESSION_MOUNTS,
      monitorSnapshot: null,
      monitorLedger: [],
      monitorError: null,
      monitorScanned: {},
      monitorPinned: [],
      monitorHidden: [],
      monitorLearned: PORTS_LEARNED,
    });
    useAppStore.getState().openStudio({ studio: { kind: 'monitoring' } });
    setIsReady(true);
  }, [variant]);

  useSceneClicks({
    isReady,
    labels: BUTTON_CLICKS[variant],
    selector: 'button',
    match: 'prefix',
    intervalMs: CLICK_MS,
  });
  useSceneClicks({
    isReady,
    labels: ITEM_CLICKS[variant],
    selector: '[role="menuitem"]',
    match: 'prefix',
    intervalMs: CLICK_MS * 4,
  });

  if (!isReady) {
    return null;
  }

  return (
    <main className="flex h-screen overflow-hidden bg-background text-foreground">
      <PageSheet>
        <MonitoringStudio onClose={NOOP} />
      </PageSheet>
    </main>
  );
};

export const U25_PORTS_SCENES = {
  'ports-layers': () => <PortsScene variant="layers" />,
  'ports-pin-popover': () => <PortsScene variant="popover" />,
  'ports-row-menu': () => <PortsScene variant="rowmenu" />,
  'ports-pinned-menu': () => <PortsScene variant="pinnedmenu" />,
  'ports-listening': () => <PortsScene variant="listening" />,
  'ports-hidden': () => <PortsScene variant="hidden" />,
};
