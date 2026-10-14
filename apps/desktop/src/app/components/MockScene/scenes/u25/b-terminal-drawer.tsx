import { useEffect, useState } from 'react';
import type { MountId } from '@goodboy/types';
import { brandedId } from '../../../../../features/history/testing/brandedId';
import { TerminalStudio } from '../../../../../features/terminal/components/TerminalStudio';
import type { TerminalTab, TerminalTabId } from '../../../../../shared/types/terminal';
import { useAppStore } from '../../../../../store';
import { sessionTerminalOwner } from '../../../../../store/slices/terminal/terminalOwner';
import { SESSION, SESSION_ID, seedActivityRunScene } from '../activityRunSeed';
import { PageSheet } from '../PageSheet';
import { mockSceneIpc } from '../mockSceneIpc';
import { DrawerStage } from '../u23/drawerChrome/DrawerStage';

const WORKTREE = '~/code/harborline/payments-api-idempotency';
const SESSION_TERMINAL = brandedId<TerminalTabId>({ value: `${SESSION_ID}::t1` });
const SECOND_TERMINAL = brandedId<TerminalTabId>({ value: `${SESSION_ID}::t2` });
const THIRD_TERMINAL = brandedId<TerminalTabId>({ value: `${SESSION_ID}::t3` });
const FOLDER = '~/code/harborline';
const STAGE_WIDTH = 1280;
const NOOP = () => undefined;
const PAYMENTS_MOUNT_ID = brandedId<MountId>({ value: 'mock-run-mount-payments' });
const CONSOLE_MOUNT_ID = brandedId<MountId>({ value: 'mock-run-mount-console' });

const tabOf = ({
  id,
  title,
  cwd,
  mountId,
}: Pick<TerminalTab, 'id' | 'title' | 'cwd' | 'mountId'>): TerminalTab => ({
  id,
  owner: sessionTerminalOwner({ sessionId: SESSION_ID }),
  title,
  cwd,
  ...(mountId === undefined ? {} : { mountId }),
  status: 'running',
  createdAt: 0,
});

type SeedParams = Record<never, never>;

const seedTabs = ({}: SeedParams): void => {
  mockSceneIpc(() => null);
  useAppStore.setState({
    loadSessionMounts: async () => [],
    terminalTabs: {
      [SESSION_ID]: [
        tabOf({ id: SESSION_TERMINAL, title: 'shell', cwd: WORKTREE, mountId: PAYMENTS_MOUNT_ID }),
        tabOf({
          id: SECOND_TERMINAL,
          title: 'shell',
          cwd: '~/code/harborline/notify-relay-retry-state',
          mountId: CONSOLE_MOUNT_ID,
        }),
        tabOf({
          id: THIRD_TERMINAL,
          title: 'dev server',
          cwd: WORKTREE,
          mountId: PAYMENTS_MOUNT_ID,
        }),
      ],
    },
    activeTerminalTab: { [SESSION_ID]: SESSION_TERMINAL },
    terminalWorktreeActive: { [`${SESSION_ID}#m:${PAYMENTS_MOUNT_ID}`]: SESSION_TERMINAL },
  });
};

const openDrawerOnFirst = ({}: SeedParams): void => {
  seedTabs({});
  useAppStore.getState().openDrawer({
    kind: 'terminal',
    sessionId: SESSION_ID,
    payload: { terminalId: SESSION_TERMINAL },
  });
};

const TerminalPageScene = ({}: SeedParams) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedActivityRunScene();
    seedTabs({});
    const workspaceId = useAppStore.getState().currentWorkspaceId;
    if (workspaceId !== null) {
      useAppStore.setState({
        terminalTabs: {
          ...useAppStore.getState().terminalTabs,
          [`ws:${workspaceId}`]: [
            {
              id: brandedId<TerminalTabId>({ value: `ws:${workspaceId}::t1` }),
              owner: { kind: 'workspace', workspaceId },
              title: 'harborline',
              cwd: FOLDER,
              status: 'running',
              createdAt: 0,
            },
          ],
        },
      });
      useAppStore.getState().openStudio({
        studio: {
          kind: 'terminal',
          terminalId: SESSION_TERMINAL,
          sessionId: SESSION_ID,
          worktree: `${SESSION_ID}#m:${PAYMENTS_MOUNT_ID}`,
        },
      });
    }
    setIsReady(true);
  }, []);

  const workspaceId = useAppStore((state) => state.currentWorkspaceId);
  if (!isReady || workspaceId === null) {
    return null;
  }

  return (
    <main className="flex h-screen overflow-hidden bg-background text-foreground">
      <PageSheet>
        <TerminalStudio
          workspaceId={workspaceId}
          terminalId={SESSION_TERMINAL}
          sessionId={SESSION.id}
          worktree={`${SESSION_ID}#m:${PAYMENTS_MOUNT_ID}`}
          onClose={NOOP}
        />
      </PageSheet>
    </main>
  );
};

export const U25_B_TERMINAL_DRAWER_SCENES = {
  'terminal-drawer-session': () => (
    <DrawerStage width={STAGE_WIDTH} prepare={() => openDrawerOnFirst({})} />
  ),
  'terminal-drawer-page': TerminalPageScene,
};
