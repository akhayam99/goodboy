import { useEffect, useState } from 'react';
import { DrawerColumn } from '@goodboy/ui';
import { brandedId } from '../../../../../../features/history/testing/brandedId';
import type { TerminalTabId } from '../../../../../../shared/types/terminal';
import { useAppStore } from '../../../../../../store';
import { selectDrawerSizing } from '../../../../../../store/slices/drawer/selectDrawerSizing';
import type { OpenDrawer } from '../../../../../../store/slices/drawer/state';
import { sessionTerminalOwner } from '../../../../../../store/slices/terminal/terminalOwner';
import { SessionTools } from '../../../../../../features/session/components/SessionTools';
import { DrawerHost } from '../../../../DrawerHost';
import { mockSceneIpc } from '../../mockSceneIpc';
import { shellPromptLines, terminalSnapshotAnswer } from '../../terminalSceneOutput';
import { PlanDrawerRunStub } from '../../u21/PlanDrawerRunStub';
import {
  PLAN_DRAWER_PLAN_ID,
  PLAN_DRAWER_SESSION_ID,
  seedPlanDrawerScene,
} from '../../u21/planDrawerSeed';

export type SlotBackChipState = 'plan' | 'swapped' | 'narrow';

type Props = {
  readonly state: SlotBackChipState;
  readonly hasRail?: boolean;
};

type SeedParams = {
  readonly state: SlotBackChipState;
};

const NARROW_WIDTH_PX = 1000;

const TERMINAL_ID = brandedId<TerminalTabId>({ value: `${PLAN_DRAWER_SESSION_ID}::t1` });

const PLAN: OpenDrawer = {
  kind: 'artifact-document',
  sessionId: PLAN_DRAWER_SESSION_ID,
  payload: { artifactId: PLAN_DRAWER_PLAN_ID, revision: null },
};

const TERMINAL: OpenDrawer = {
  kind: 'terminal',
  sessionId: PLAN_DRAWER_SESSION_ID,
  payload: { terminalId: TERMINAL_ID },
};

const TERMINAL_SNAPSHOT = terminalSnapshotAnswer({
  lines: shellPromptLines({ folder: 'ledger-core gb-4m8r2t' }),
});

const seedSlot = ({ state }: SeedParams): void => {
  seedPlanDrawerScene({ variant: 'waiting' });
  useAppStore.setState({
    terminalTabs: {
      [PLAN_DRAWER_SESSION_ID]: [
        {
          id: TERMINAL_ID,
          owner: sessionTerminalOwner({ sessionId: PLAN_DRAWER_SESSION_ID }),
          title: 'shell',
          cwd: '~/code/harborline/ledger-core/.goodboy/worktrees/gb-4m8r2t',
          status: 'running',
          createdAt: 0,
        },
      ],
    },
    activeTerminalTab: { [PLAN_DRAWER_SESSION_ID]: TERMINAL_ID },
    drawer: state === 'swapped' ? TERMINAL : PLAN,
    drawerBack: state === 'swapped' ? PLAN : TERMINAL,
  });
  if (state === 'swapped') {
    mockSceneIpc((command) => (command === 'terminal_snapshot' ? TERMINAL_SNAPSHOT : null));
  }
};

export const SlotBackChipScene = ({ state, hasRail = false }: Props) => {
  const [isReady, setIsReady] = useState(false);
  const sizing = useAppStore(selectDrawerSizing);
  const isDrawerOpen = useAppStore((s) => s.drawer !== null);

  useEffect(() => {
    seedSlot({ state });
    setIsReady(true);
  }, [state]);

  if (!isReady) {
    return null;
  }

  return (
    <main
      data-testid="slot-back-chip-scene"
      data-state={state}
      className="flex h-screen bg-background text-foreground"
      style={state === 'narrow' ? { width: NARROW_WIDTH_PX } : undefined}
    >
      <DrawerColumn
        main={<PlanDrawerRunStub />}
        drawer={isDrawerOpen ? <DrawerHost /> : null}
        sizing={sizing}
        ariaLabel="Side panel"
        resizeLabel="Resize side panel"
      />
      {hasRail ? <SessionTools sessionId={PLAN_DRAWER_SESSION_ID} /> : null}
    </main>
  );
};
