// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { HistoryBackup } from '@goodboy/types';

const engine = vi.hoisted(() => ({ listHistoryBackups: vi.fn() }));

vi.mock('../../historyEngine', () => engine);

import { formatDayMonth } from '../../../../shared/utils/time/formatDayMonth';
import { HistoryBackups } from './HistoryBackups';

const backup = (overrides: Partial<HistoryBackup>): HistoryBackup => ({
  refName: 'refs/goodboy/backup/b-686c2f6c6564676572/1790000000000000000',
  sha: 'a1f3c20aa0000000000000000000000000000000',
  subject: 'Add ledger export endpoint',
  createdAt: 1_790_000_000,
  isLegacy: false,
  ...overrides,
});

afterEach(cleanup);

describe('HistoryBackups', () => {
  it('offers restore for a backup of this branch and none for an older one it cannot prove', async () => {
    engine.listHistoryBackups.mockResolvedValue([
      backup({}),
      backup({
        refName: 'refs/goodboy/backup/hl-ledger-export/1780000000000000000',
        subject: 'Stream rows in batches of 500',
        isLegacy: true,
      }),
    ]);
    render(
      <HistoryBackups
        worktreePath="/w/payments"
        branch="hl/ledger-export"
        hasUpstream
        revision={0}
        onRestore={() => undefined}
        onClose={() => undefined}
      />,
    );
    expect(await screen.findByText('Older backup, read-only')).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'Restore previous history' })).toHaveLength(1);
  });

  it('asks in a popover beside the row and restores only on confirm', async () => {
    const onRestore = vi.fn();
    const found = backup({});
    engine.listHistoryBackups.mockResolvedValue([found]);
    const { container } = render(
      <HistoryBackups
        worktreePath="/w/payments"
        branch="hl/ledger-export"
        hasUpstream={false}
        revision={0}
        onRestore={onRestore}
        onClose={() => undefined}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Restore previous history' }));

    const day = formatDayMonth({ at: found.createdAt * 1000 });
    const dialog = screen.getByRole('dialog', { name: `Restore the backup from ${day}?` });
    expect(container.contains(dialog)).toBe(false);
    expect(
      within(dialog).getByText(
        'Your branch goes back to that state. The current one is kept as a backup.',
      ),
    ).toBeDefined();
    expect(onRestore).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Restore backup' }));
    await waitFor(() => expect(onRestore).toHaveBeenCalledWith(found));
  });
});
