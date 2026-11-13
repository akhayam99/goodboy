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

const dockTerminalPage = vi.fn();
const dockEmptyTerminalPage = vi.fn();

vi.mock('../../dockTerminalPage', () => ({
  dockTerminalPage: (params: unknown) => dockTerminalPage(params),
}));
vi.mock('../../dockEmptyTerminalPage', () => ({
  dockEmptyTerminalPage: (params: unknown) => dockEmptyTerminalPage(params),
}));
vi.mock('../../../monitoring/useTerminalPorts', () => ({
  useTerminalPorts: () => new Map<string, ReadonlyArray<number>>(),
}));

import { DockTerminalButton } from './DockTerminalButton';
import { TerminalTabStrip } from './TerminalTabStrip';

const SESSION_ID = brandedId<SessionId>({ value: 'session-1' });

const TAB = {
  id: brandedId<TerminalTabId>({ value: `${SESSION_ID}::t1` }),
  owner: { kind: 'session', sessionId: SESSION_ID },
  title: 'pnpm dev',
  cwd: '/work/payments-api',
  status: 'running',
  createdAt: 0,
} satisfies TerminalTab;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('the terminal row', () => {
  it('docks the selected terminal', () => {
    render(<DockTerminalButton selected={TAB} />);

    fireEvent.click(screen.getByRole('button', { name: 'Dock' }));

    expect(dockTerminalPage).toHaveBeenCalledWith({ terminalId: TAB.id, sessionId: SESSION_ID });
    expect(dockEmptyTerminalPage).not.toHaveBeenCalled();
  });

  it('docks the empty page when no terminal is open', () => {
    render(<DockTerminalButton selected={null} />);

    fireEvent.click(screen.getByRole('button', { name: 'Dock' }));

    expect(dockEmptyTerminalPage).toHaveBeenCalledWith({});
    expect(dockTerminalPage).not.toHaveBeenCalled();
  });

  it('keeps the tabs and the actions on one 40 row', () => {
    const { container } = render(
      <TerminalTabStrip
        label="payments-api"
        tabs={[TAB]}
        selectedId={TAB.id}
        busyIds={new Set<string>()}
        commandOf={() => null}
        onSelect={vi.fn()}
        onClose={vi.fn()}
        onRestart={vi.fn()}
        onRename={async () => undefined}
        onNew={vi.fn()}
        actions={<DockTerminalButton selected={TAB} />}
      />,
    );

    const row = container.firstElementChild;

    expect(container.childElementCount).toBe(1);
    expect(row?.contains(screen.getByRole('button', { name: 'Dock' }))).toBe(true);
    expect(row?.contains(screen.getByRole('tab', { name: 'pnpm dev' }))).toBe(true);
  });
});
