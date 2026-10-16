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
  readonly title: string;
};

const tabOf = ({ ordinal, title }: TabParams) =>
  ({
    id: brandedId<TerminalTabId>({ value: `${SESSION_ID}::t${ordinal}` }),
    owner: { kind: 'session', sessionId: SESSION_ID },
    title,
    cwd: '/work/payments-api',
    status: 'running',
    createdAt: 0,
  }) satisfies TerminalTab;

const FIRST = tabOf({ ordinal: 1, title: 'zsh' });
const SECOND = tabOf({ ordinal: 2, title: 'pnpm dev' });

type MountParams = {
  readonly busyIds?: ReadonlySet<string>;
  readonly selected?: TerminalTab;
  readonly isShortcutEnabled?: boolean;
};

const mountStrip = ({
  busyIds = new Set<string>(),
  selected = SECOND,
  isShortcutEnabled = true,
}: MountParams) => {
  const onClose = vi.fn();
  render(
    <TerminalTabStrip
      label="payments-api"
      tabs={[FIRST, SECOND]}
      selectedId={selected.id}
      busyIds={busyIds}
      commandOf={() => 'pnpm dev'}
      onSelect={vi.fn()}
      onClose={onClose}
      onRestart={vi.fn()}
      onRename={async () => undefined}
      onNew={vi.fn()}
      isShortcutEnabled={isShortcutEnabled}
    />,
  );
  return onClose;
};

const pressClose = (): void => {
  fireEvent.keyDown(window, { code: 'KeyW', metaKey: true });
};

afterEach(cleanup);

describe('cmd+w on the terminal tab strip', () => {
  it('closes the selected tab', () => {
    const onClose = mountStrip({});

    pressClose();

    expect(onClose).toHaveBeenCalledWith(SECOND);
  });

  it('asks before closing a tab whose shell runs a process', () => {
    const onClose = mountStrip({ busyIds: new Set([SECOND.id]) });

    pressClose();

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('pnpm dev is running. Close it?')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledWith(SECOND);
  });

  it('keeps the tab when the question is answered with Keep', () => {
    const onClose = mountStrip({ busyIds: new Set([SECOND.id]) });

    pressClose();
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByText('pnpm dev is running. Close it?')).toBeNull();
  });

  it('leaves the chord alone while the strip is not the active surface', () => {
    const onClose = mountStrip({ isShortcutEnabled: false });

    pressClose();

    expect(onClose).not.toHaveBeenCalled();
  });
});
