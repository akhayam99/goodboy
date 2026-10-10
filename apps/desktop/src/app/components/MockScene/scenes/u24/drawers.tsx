import { useEffect, useState, type ReactNode } from 'react';
import { mockIPC } from '@tauri-apps/api/mocks';
import { DrawerColumn } from '@goodboy/ui';
import { ExplorePane } from '../../../../../features/explore/components/ExplorePane';
import { useAppStore } from '../../../../../store';
import { selectDrawerPanel } from '../../../../../store/slices/drawer/selectDrawerPanel';
import { selectDrawerSizing } from '../../../../../store/slices/drawer/selectDrawerSizing';
import { DrawerHost } from '../../../DrawerHost';
import { sceneClock } from '../../sceneClock';
import { SESSION, SESSION_ID, seedActivityRunScene } from '../activityRunSeed';
import { SESSION_ID as ARTIFACT_SESSION_ID, seedArtifactScene } from '../artifactSeed';
import { payloadString } from '../audit/ipcPayload';
import { SessionOverviewPane } from '../../../../../features/session/components/SessionOverviewPane';
import { PlanDrawerRunStub } from '../u21/PlanDrawerRunStub';
import { seedPlanDrawerScene } from '../u21/planDrawerSeed';

const clock = sceneClock({ anchor: '2026-10-06T09:40:00.000Z' });

const SIDEBAR_PX = 240;
const WIDE_WIDTH_PX = 1920;
const NARROW_WIDTH_PX = 1280;
const CONTEXT_WIDTH_PX = 1440;
const SESSION_DIR = '~/code/harborline/sessions/settlement-rounding';
const MODIFIED_AT = clock.iso({ at: '2026-10-06T08:40:00.000Z' });

const noop = () => undefined;

type StageProps = {
  readonly width: number;
  readonly prepare: () => void;
  readonly main: ReactNode;
};

const DrawerSplitStage = ({ width, prepare, main }: StageProps) => {
  const [isReady, setIsReady] = useState(false);
  const isDrawerOpen = useAppStore((state) => selectDrawerPanel(state) !== null);
  const sizing = useAppStore(selectDrawerSizing);

  useEffect(() => {
    prepare();
    setIsReady(true);
  }, [prepare]);

  if (!isReady) {
    return null;
  }

  return (
    <div
      data-testid="drawer-split-stage"
      className="flex h-screen bg-chrome text-foreground"
      style={{ width }}
    >
      <div aria-hidden className="shrink-0 bg-chrome" style={{ width: SIDEBAR_PX }} />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <DrawerColumn
          main={main}
          drawer={isDrawerOpen ? <DrawerHost /> : null}
          sizing={sizing}
          frame="sheet"
          sheetEdge="wrapped"
          ariaLabel="Side panel"
          resizeLabel="Resize side panel"
        />
      </main>
    </div>
  );
};

const preparePlan = (): void => {
  seedPlanDrawerScene({ variant: 'follow' });
};

const prepareContext = (): void => {
  seedActivityRunScene();
  useAppStore.setState({ selectedAgentId: {} });
  useAppStore.getState().openContextDrawer({ sessionId: SESSION_ID, tab: 'goal' });
};

type EntryParams = {
  readonly name: string;
  readonly relPath: string;
  readonly isDir: boolean;
  readonly sizeBytes: number;
};

const entry = ({ name, relPath, isDir, sizeBytes }: EntryParams) => ({
  name,
  relPath,
  isDir,
  sizeBytes,
  modifiedAt: MODIFIED_AT,
});

const BRIEF_ENTRY = entry({ name: 'brief.md', relPath: 'brief.md', isDir: false, sizeBytes: 2140 });

const ROOT = [
  entry({ name: 'notes', relPath: 'notes', isDir: true, sizeBytes: 0 }),
  entry({ name: 'exports', relPath: 'exports', isDir: true, sizeBytes: 0 }),
  BRIEF_ENTRY,
  entry({
    name: 'settlement-batches.csv',
    relPath: 'settlement-batches.csv',
    isDir: false,
    sizeBytes: 482113,
  }),
  entry({
    name: 'drift-summary.xlsx',
    relPath: 'drift-summary.xlsx',
    isDir: false,
    sizeBytes: 90211,
  }),
];

const BRIEF = `# Settlement rounding brief

Northwind finance sees one cent drift on split batches.

- ledger-core rounds each posting
- the backfill must stay in dry run until totals match
`;

const prepareExplore = (): void => {
  mockIPC((command, payload) => {
    if (command === 'explore_list') {
      return payloadString({ payload, key: 'relPath' }) === null ? ROOT : [];
    }
    if (command === 'explore_read') {
      return { type: 'text', text: BRIEF, truncated: false };
    }
    return null;
  });
  seedArtifactScene({ focusedArtifactId: null });
  useAppStore.getState().openDrawer({
    kind: 'explore-file',
    sessionId: ARTIFACT_SESSION_ID,
    payload: { sessionDir: SESSION_DIR, entry: BRIEF_ENTRY },
  });
};

export const U24_DRAWERS_SCENES = {
  'drawer-split-plan': () => (
    <DrawerSplitStage width={WIDE_WIDTH_PX} prepare={preparePlan} main={<PlanDrawerRunStub />} />
  ),
  'drawer-split-plan-1280': () => (
    <DrawerSplitStage width={NARROW_WIDTH_PX} prepare={preparePlan} main={<PlanDrawerRunStub />} />
  ),
  'drawer-split-context': () => (
    <DrawerSplitStage
      width={CONTEXT_WIDTH_PX}
      prepare={prepareContext}
      main={
        <div className="@container flex h-full w-full min-w-0 flex-col">
          <SessionOverviewPane session={SESSION} onSelectLens={noop} />
        </div>
      }
    />
  ),
  'drawer-split-explore': () => (
    <DrawerSplitStage
      width={WIDE_WIDTH_PX}
      prepare={prepareExplore}
      main={<ExplorePane sessionId={ARTIFACT_SESSION_ID} sessionDir={SESSION_DIR} />}
    />
  ),
};
