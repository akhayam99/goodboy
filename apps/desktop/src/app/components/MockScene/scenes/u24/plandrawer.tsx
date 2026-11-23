import { useEffect, useState, type ReactNode } from 'react';
import { AppShell } from '@goodboy/ui';
import { useAppStore } from '../../../../../store';
import { selectDrawerPanel } from '../../../../../store/slices/drawer/selectDrawerPanel';
import { detailWidthIdOf } from '../../../../../store/slices/drawer/detailWidthIdOf';
import { selectDrawerSizing } from '../../../../../store/slices/drawer/testing/selectDrawerSizing';
import { DrawerHost } from '../../../DrawerHost';
import { ScenePlacesRail } from '../ScenePlacesRail';
import { SESSION_ID, REPORT_ARTIFACT_ID, seedArtifactScene } from '../artifactSeed';
import { PlanDrawerRunStub } from '../u21/PlanDrawerRunStub';
import { seedPlanDrawerScene } from '../u21/planDrawerSeed';

const WIDTH_PX = 1920;
const WIDE_DRAWER_PX = 1000;

const readerWidthKey = (): string => {
  const id = detailWidthIdOf({ drawer: useAppStore.getState().drawer }) ?? 'reader';
  return `goodboy:detail-width:${id}:v1`;
};

const saveReaderWidth = (widthPx: number | null): void => {
  try {
    if (widthPx === null) {
      localStorage.removeItem(readerWidthKey());
      return;
    }
    localStorage.setItem(readerWidthKey(), String(widthPx));
  } catch {
    return;
  }
};

type StageProps = {
  readonly savedWidthPx: number | null;
  readonly prepare: () => void;
  readonly main: ReactNode;
};

const ReaderDrawerStage = ({ savedWidthPx, prepare, main }: StageProps) => {
  const [isReady, setIsReady] = useState(false);
  const isDrawerOpen = useAppStore((state) => selectDrawerPanel(state) !== null);
  const sizing = useAppStore(selectDrawerSizing);

  useEffect(() => {
    prepare();
    saveReaderWidth(savedWidthPx);
    setIsReady(true);
    return () => saveReaderWidth(null);
  }, [prepare, savedWidthPx]);

  if (!isReady) {
    return null;
  }

  return (
    <div data-testid="plandrawer-stage" className="[&>div]:w-full" style={{ width: WIDTH_PX }}>
      <AppShell
        leftRail={<ScenePlacesRail />}
        main={main}
        drawer={isDrawerOpen ? <DrawerHost /> : null}
        drawerSizing={sizing}
      />
    </div>
  );
};

const preparePlan = (): void => {
  seedPlanDrawerScene({ variant: 'follow' });
};

const prepareReport = (): void => {
  seedArtifactScene({ focusedArtifactId: null });
  useAppStore.getState().openDrawer({
    kind: 'artifact-document',
    sessionId: SESSION_ID,
    payload: { artifactId: REPORT_ARTIFACT_ID, revision: null },
  });
};

export const U24_PLANDRAWER_SCENES = {
  'plandrawer-720': () => (
    <ReaderDrawerStage savedWidthPx={null} prepare={preparePlan} main={<PlanDrawerRunStub />} />
  ),
  'plandrawer-1000': () => (
    <ReaderDrawerStage
      savedWidthPx={WIDE_DRAWER_PX}
      prepare={preparePlan}
      main={<PlanDrawerRunStub />}
    />
  ),
  'reportdrawer-720': () => (
    <ReaderDrawerStage
      savedWidthPx={null}
      prepare={prepareReport}
      main={
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 p-6">
          <h1 className="text-title text-foreground">Settlement rounding</h1>
          <p className="text-meta text-muted-foreground">
            The report from the last run is open beside.
          </p>
        </div>
      }
    />
  ),
};
