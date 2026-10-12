// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { FileDiff } from '@goodboy/types';
import {
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../store/storyHarness';
import { worktreeFileSides } from '../../../worktree/worktree';
import type { FileSidesLoader } from '../../hooks/useFileSides';
import { DiffView } from './index';

const FILE: FileDiff = {
  path: 'ledger-core.ts',
  status: 'modified',
  additions: 1,
  deletions: 1,
  binary: false,
  hunks: [
    {
      header: '',
      oldStart: 30,
      newStart: 30,
      oldLines: 1,
      newLines: 1,
      lines: [{ kind: 'context', oldLine: 30, newLine: 30, text: 'ledger30' }],
    },
  ],
};
const TEXT = Array.from({ length: 100 }, (_, index) => `ledger${index + 1}`).join('\n');
const SIDES = { old: TEXT, new: TEXT, too_large: false };
const load: FileSidesLoader = (file) =>
  worktreeFileSides({ worktreePath: '/mock/payments-api', path: file.path });

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ worktree_file_sides: SIDES });
});
afterEach(() => {
  cleanup();
});

describe('diff context interaction', () => {
  it('shows loading and retries the failed direction without losing context', async () => {
    let rejectRead: (error: Error) => void = () => undefined;
    stubStoryInvoke({
      worktree_file_sides: () =>
        new Promise((_resolve, reject) => {
          rejectRead = reject;
        }),
    });
    render(<DiffView files={[FILE]} loadFileSides={load} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show 20 preceding lines' }));
    expect(screen.getByRole('status', { name: 'Loading unchanged lines' })).toBeDefined();
    await act(async () => {
      rejectRead(new Error('read failed'));
    });
    expect(await screen.findByText("Couldn't load the lines")).toBeDefined();
    expect(screen.queryByText('ledger29')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse ledger-core.ts' }));
    fireEvent.click(screen.getByRole('button', { name: 'Expand ledger-core.ts' }));
    stubStoryInvoke({ worktree_file_sides: SIDES });
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('ledger10')).toBeDefined();
    expect(screen.getByText('ledger29')).toBeDefined();
    expect(screen.queryByText('ledger9')).toBeNull();
  });

  it('retains expanded lines through scrolling and collapse, then resets on refresh', async () => {
    const view = render(<DiffView files={[FILE]} loadFileSides={load} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show all 29 hidden lines' }));
    expect(await screen.findByText('ledger1')).toBeDefined();
    fireEvent.scroll(screen.getByRole('grid', { name: 'Changes in ledger-core.ts' }));
    fireEvent.click(screen.getByRole('button', { name: 'Collapse ledger-core.ts' }));
    fireEvent.click(screen.getByRole('button', { name: 'Expand ledger-core.ts' }));
    expect(screen.getByText('ledger1')).toBeDefined();
    view.rerender(<DiffView files={[{ ...FILE, hunks: [...FILE.hunks] }]} loadFileSides={load} />);
    expect(screen.queryByText('ledger1')).toBeNull();
    expect(screen.getByRole('button', { name: 'Show all 29 hidden lines' })).toBeDefined();
  });

  it('expands the whole file again when the same path reopens at another revision', async () => {
    const view = render(<DiffView files={[FILE]} loadFileSides={load} isWholeFile />);
    expect(await screen.findByText('ledger1')).toBeDefined();
    view.rerender(
      <DiffView files={[{ ...FILE, hunks: [...FILE.hunks] }]} loadFileSides={load} isWholeFile />,
    );
    expect(await screen.findByText('ledger1')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Show all 29 hidden lines' })).toBeNull();
  });

  it('expand all reveals windowed hunks and opens a collapsed file', async () => {
    const text = Array.from({ length: 1200 }, (_, index) => `ledger${index + 1}`).join('\n');
    stubStoryInvoke({ worktree_file_sides: { old: text, new: text, too_large: false } });
    const file: FileDiff = {
      ...FILE,
      hunks: [
        {
          ...FILE.hunks[0],
          header: '',
          oldStart: 10,
          newStart: 10,
          oldLines: 1100,
          newLines: 1100,
          lines: Array.from({ length: 1100 }, (_, index) => ({
            kind: 'context',
            oldLine: index + 10,
            newLine: index + 10,
            text: `ledger${index + 10}`,
          })),
        },
      ],
    };
    const registration: { expand: (() => Promise<void>) | null } = { expand: null };
    render(
      <DiffView
        files={[file]}
        loadFileSides={load}
        registerExpandAll={(_path, expand) => {
          registration.expand = expand;
        }}
      />,
    );
    expect(screen.queryByText('ledger1109')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse ledger-core.ts' }));
    await act(async () => {
      if (registration.expand === null) {
        throw new Error('expand all was not registered');
      }
      await registration.expand();
    });
    expect(await screen.findByText('ledger1200')).toBeDefined();
    expect(screen.getByText('ledger1109')).toBeDefined();
    expect(screen.getByText('ledger1')).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Show \d/ })).toBeNull();
  });

  it('expand all opens a rename with no changed hunk', async () => {
    const file: FileDiff = { ...FILE, status: 'renamed', oldPath: 'notify-relay.ts', hunks: [] };
    const registration: { expand: (() => Promise<void>) | null } = { expand: null };
    render(
      <DiffView
        files={[file]}
        loadFileSides={load}
        registerExpandAll={(_path, expand) => {
          registration.expand = expand;
        }}
      />,
    );
    await act(async () => {
      if (registration.expand === null) {
        throw new Error('expand all was not registered');
      }
      await registration.expand();
    });
    expect(await screen.findByText('ledger100')).toBeDefined();
    expect(screen.getByText('ledger1')).toBeDefined();
  });

  it('opens the editor on the file that exceeded the limits', async () => {
    stubStoryInvoke({ worktree_file_sides: { old: null, new: null, too_large: true } });
    const open = vi.fn();
    render(<DiffView files={[FILE]} loadFileSides={load} fileActions={{ onOpenInEditor: open }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show all 29 hidden lines' }));
    await screen.findAllByText('This file is too large to expand here.');
    const button = screen.getAllByRole('button', { name: 'Open in editor' })[0];
    expect(button).toBeDefined();
    if (button === undefined) {
      throw new Error('editor action missing');
    }
    fireEvent.click(button);
    expect(open).toHaveBeenCalledWith(FILE.path);
  });
});
