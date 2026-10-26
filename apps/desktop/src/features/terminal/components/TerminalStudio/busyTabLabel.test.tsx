// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import type { TerminalTab, TerminalTabId } from '../../../../shared/types/terminal';
import { brandedId } from '../../../history/testing/brandedId';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/platform', () => ({ currentPlatform: () => 'darwin' }));
vi.mock('../../../monitoring/useTerminalPorts', () => ({
  useTerminalPorts: () => new Map<string, ReadonlyArray<number>>(),
}));

import { TerminalTabStrip } from './TerminalTabStrip';

const SESSION_ID = brandedId<SessionId>({ value: 'session-1' });

type TabParams = {
  readonly ordinal: number;
};

const tabOf = ({ ordinal }: TabParams) =>
  ({
    id: brandedId<TerminalTabId>({ value: `${SESSION_ID}::t${ordinal}` }),
    owner: { kind: 'session', sessionId: SESSION_ID },
    title: `Terminal ${ordinal}`,
    cwd: '/work/payments-api',
    status: 'running',
    createdAt: 0,
  }) satisfies TerminalTab;

const FIRST = tabOf({ ordinal: 1 });
const SECOND = tabOf({ ordinal: 2 });

const mountStrip = ({ busyIds }: { readonly busyIds: ReadonlySet<string> }) =>
  render(
    <TerminalTabStrip
      label="payments-api"
      tabs={[FIRST, SECOND]}
      selectedId={FIRST.id}
      busyIds={busyIds}
      commandOf={(tab) => (tab.id === SECOND.id ? 'pnpm test' : null)}
      onSelect={vi.fn()}
      onClose={vi.fn()}
      onRestart={vi.fn()}
      onRename={async () => undefined}
      onNew={vi.fn()}
      isShortcutEnabled
    />,
  );

afterEach(cleanup);

describe('a busy terminal tab', () => {
  it('names what it runs next to its title, and the close question uses the same name', () => {
    mountStrip({ busyIds: new Set([SECOND.id]) });

    expect(screen.getAllByText('pnpm test')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Close Terminal 2' }));
    expect(screen.getAllByText('Terminal 2 is running. Close it?')).toHaveLength(1);
    expect(screen.getAllByText('pnpm test')).toHaveLength(2);
  });

  it('shows no process name on an idle tab', () => {
    mountStrip({ busyIds: new Set() });

    expect(screen.queryByText('pnpm test')).toBeNull();
  });
});
