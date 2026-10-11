// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { TerminalTab, TerminalTabId } from '../../../../shared/types/terminal';
import { TerminalRow } from './TerminalRow';

afterEach(cleanup);

const TAB: TerminalTab = {
  id: 'mock-session::t1' as TerminalTabId,
  owner: { kind: 'workspace', workspaceId: 'mock-workspace' as never },
  title: 'payments-api',
  cwd: '/mock/harborline/payments-api',
  status: 'running',
  createdAt: 0,
};

const renderRow = (ports: ReadonlyArray<number>) =>
  render(
    <ul>
      <TerminalRow
        tab={TAB}
        isSelected={false}
        isBusy={false}
        command={null}
        ports={ports}
        onSelect={vi.fn()}
        onClose={vi.fn()}
        onRestart={vi.fn()}
        onRename={vi.fn(async () => undefined)}
      />
    </ul>,
  );

describe('a terminal row', () => {
  it('shows a chip for each port its process tree listens on', () => {
    renderRow([5005, 5006]);

    expect(screen.getByText(':5005')).toBeDefined();
    expect(screen.getByText(':5006')).toBeDefined();
  });

  it('shows no chip when nothing listens', () => {
    renderRow([]);

    expect(screen.queryByText(/^:\d+$/)).toBeNull();
  });
});
