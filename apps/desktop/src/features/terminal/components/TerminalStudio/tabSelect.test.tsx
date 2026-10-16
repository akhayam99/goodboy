// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import type { TerminalTab, TerminalTabId } from '../../../../shared/types/terminal';
import { brandedId } from '../../../history/testing/brandedId';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

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

const FIRST = tabOf({ ordinal: 1, title: 'pnpm dev' });
const SECOND = tabOf({ ordinal: 2, title: 'zsh' });

vi.mock('../../../monitoring/useTerminalPorts', () => ({
  useTerminalPorts: () => new Map<string, ReadonlyArray<number>>([[FIRST.id, [10350, 57033]]]),
}));

import { TerminalTabStrip } from './TerminalTabStrip';

const mountStrip = (selected: TerminalTab) => {
  const onSelect = vi.fn();
  render(
    <TerminalTabStrip
      label="payments-api"
      tabs={[FIRST, SECOND]}
      selectedId={selected.id}
      busyIds={new Set<string>()}
      commandOf={() => null}
      onSelect={onSelect}
      onClose={vi.fn()}
      onRestart={vi.fn()}
      onRename={async () => undefined}
      onNew={vi.fn()}
    />,
  );
  return onSelect;
};

const tabBody = (tab: TerminalTab): HTMLElement => {
  const body = document.querySelector<HTMLElement>(`[data-terminal-tab="${tab.id}"]`);
  if (body === null) {
    throw new Error('missing tab');
  }
  return body;
};

afterEach(cleanup);

describe('the terminal tabs', () => {
  it('selects the tab on a click anywhere on its body', () => {
    const onSelect = mountStrip(SECOND);

    fireEvent.click(tabBody(FIRST));

    expect(onSelect).toHaveBeenCalledWith(FIRST);
  });

  it('selects the previous tab by its name even when it listens on two ports', () => {
    const onSelect = mountStrip(SECOND);

    fireEvent.click(screen.getByRole('tab', { name: 'pnpm dev' }));

    expect(onSelect).toHaveBeenCalledWith(FIRST);
  });

  it('keeps a width floor on the name of a tab', () => {
    mountStrip(SECOND);

    expect(screen.getByRole('tab', { name: 'pnpm dev' }).style.minWidth).toBe('48px');
  });

  it('keeps ports off every tab and shows those of the selected tab at the right of the strip', () => {
    mountStrip(FIRST);

    expect(within(tabBody(FIRST)).queryByRole('button', { name: /localhost/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Open localhost:10350' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Open localhost:57033' })).toBeDefined();
  });

  it('shows no ports while a tab without listeners is selected', () => {
    mountStrip(SECOND);

    expect(screen.queryByRole('button', { name: /localhost/ })).toBeNull();
  });

  it('does not select twice when the close button is pressed', () => {
    const onSelect = mountStrip(SECOND);

    fireEvent.click(within(tabBody(FIRST)).getByRole('button', { name: 'Close pnpm dev' }));

    expect(onSelect).not.toHaveBeenCalled();
  });
});
