import { useEffect, useState } from 'react';
import type { MountId } from '@goodboy/types';
import { BrowserPane } from '../../../../../../features/browser/components/BrowserPane';
import { brandedId } from '../../../../../../features/history/testing/brandedId';
import { TerminalDrawer } from '../../../../../../features/terminal/components/TerminalDrawer';
import { applyDocumentTheme } from '../../../../../../shared/lib/theme';
import type { TerminalTabId } from '../../../../../../shared/types/terminal';
import { useAppStore } from '../../../../../../store';
import { sessionTerminalOwner } from '../../../../../../store/slices/terminal/terminalOwner';
import { SESSION_ID } from '../../activityRunSeed';
import { seedBrowserPane } from '../browser/browserPaneSeed';

const TERMINAL_ID = brandedId<TerminalTabId>({ value: `${SESSION_ID}::t1` });
const PAYMENTS_MOUNT_ID = brandedId<MountId>({ value: 'mock-run-mount-payments' });
const WORKTREE = '~/code/harborline/payments-api/.goodboy/worktrees/gb-7k2q9x';
const TERMINAL_WIDTH_PX = 300;
const BROWSER_WIDTH_PX = 380;
const PANE_CLASS =
  'flex min-h-0 shrink-0 flex-col overflow-hidden rounded-frame border border-frame-edge bg-panel-surface';

const noop = () => undefined;

const seedNarrowHeads = (): void => {
  seedBrowserPane({ state: 'pane' });
  useAppStore.setState({
    loadSessionMounts: async () => [],
    terminalTabs: {
      [SESSION_ID]: [
        {
          id: TERMINAL_ID,
          owner: sessionTerminalOwner({ sessionId: SESSION_ID }),
          title: 'shell',
          cwd: WORKTREE,
          mountId: PAYMENTS_MOUNT_ID,
          status: 'running',
          createdAt: 0,
        },
      ],
    },
    activeTerminalTab: { [SESSION_ID]: TERMINAL_ID },
    terminalWorktreeActive: { [`${SESSION_ID}#m:${PAYMENTS_MOUNT_ID}`]: TERMINAL_ID },
  });
};

type Props = {
  readonly theme: 'light' | 'dark';
};

export const NarrowHeadsScene = ({ theme }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    applyDocumentTheme({ theme });
    seedNarrowHeads();
    setIsReady(true);
  }, [theme]);

  if (!isReady) {
    return null;
  }
  return (
    <main data-shot className="flex h-screen gap-3 bg-background p-3 text-foreground">
      <div data-narrow-pane="terminal" className={PANE_CLASS} style={{ width: TERMINAL_WIDTH_PX }}>
        <TerminalDrawer sessionId={SESSION_ID} terminalId={TERMINAL_ID} onClose={noop} />
      </div>
      <div data-narrow-pane="browser" className={PANE_CLASS} style={{ width: BROWSER_WIDTH_PX }}>
        <BrowserPane sessionId={SESSION_ID} onClose={noop} />
      </div>
    </main>
  );
};
