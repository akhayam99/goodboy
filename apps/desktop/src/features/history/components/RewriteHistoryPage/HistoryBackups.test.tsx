// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { HistoryBackup } from '@goodboy/types';

const engine = vi.hoisted(() => ({ listHistoryBackups: vi.fn() }));

vi.mock('../../historyEngine', () => engine);

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
});
