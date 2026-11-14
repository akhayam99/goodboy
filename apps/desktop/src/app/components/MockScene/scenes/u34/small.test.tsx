// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { U34_SMALL_SCENES } from './small';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

beforeAll(async () => {
  installFakeResizeObserver();
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  clearSceneInvoke();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

type MountParams = { readonly name: keyof typeof U34_SMALL_SCENES };
const mount = ({ name }: MountParams) => {
  const Scene = U34_SMALL_SCENES[name];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the small flows scenes', () => {
  it('keeps one question on the board with one Answer button', async () => {
    mount({ name: 'u34-u5-question' });
    const board = await screen.findByRole('region', { name: 'Branches' });
    const state = (await importStore()).getState();
    expect(Object.values(state.sessionOpenQuestions).flat()).toHaveLength(1);
    expect(within(board).getAllByRole('button', { name: 'Answer' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Answer' })).toHaveLength(1);
    expect(within(board).queryByRole('button', { name: 'See result' })).toBeNull();
  });

  it('draws one mark per row, an empty slot at rest, and a bold title when unread', () => {
    const { container } = mount({ name: 'u34-u22-row-marks' });
    const rows = [...container.querySelectorAll<HTMLElement>('[data-row-mark]')];
    expect(rows).toHaveLength(8);
    expect(container.querySelectorAll('[data-testid="state-node-slot"]')).toHaveLength(4);
    expect(container.querySelectorAll('.bg-unread')).toHaveLength(0);
    for (const row of rows) {
      expect(row.querySelectorAll('[data-node-kind]')).toHaveLength(1);
    }
    const bold = container.querySelectorAll('.text-row-strong');
    expect([...bold].map((title) => title.textContent)).toEqual([
      'Stop retried webhooks posting twice',
      'Draft the payout delay notice',
    ]);
  });

  it('mounts the branch header with commit wording', async () => {
    const { container } = mount({ name: 'u34-u35-unpushed' });
    await waitFor(() => expect(container.querySelector('[data-branch-start-line]')).not.toBeNull());
    expect(container.textContent).not.toMatch(/Push \d+ fixes/);
  });

  it('keeps request numbers in the branch rows', async () => {
    const { container } = mount({ name: 'u34-u33-branches' });
    await waitFor(() => expect(container.querySelector('[data-worktree-branch]')).not.toBeNull());
    expect(container.querySelectorAll('[data-worktree-branch]').length).toBeGreaterThan(1);
    expect(screen.queryByRole('button', { name: /^Open rebase of/ })).toBeNull();
    const rows = [...container.querySelectorAll('[data-worktree-branch]')].map(
      (row) => row.textContent ?? '',
    );
    expect(rows.some((text) => text.includes('#318'))).toBe(true);
    expect(rows.some((text) => text.includes('#322'))).toBe(true);
    expect(rows.some((text) => text.includes('harborline/'))).toBe(false);
  });

  it('names the run on the step back row and draws no trail', async () => {
    mount({ name: 'u34-u56-step' });
    await waitFor(() =>
      expect(document.querySelector('[data-session-back]')?.textContent).toBe(
        'Back to Speed up the export end to end',
      ),
    );
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull();
  });

  it('offers provider recovery above Retry', () => {
    mount({ name: 'u34-u12-provider' });
    const open = vi.fn();
    window.addEventListener('goodboy:open-settings', open, { once: true });
    const alert = screen.getByRole('alert');
    fireEvent.click(within(alert).getByRole('button', { name: 'Connect a provider' }));
    expect(open).toHaveBeenCalledTimes(1);
    expect(
      within(alert)
        .getByRole('button', { name: 'Connect a provider' })
        .getAttribute('data-variant'),
    ).toBe('primary');
    expect(screen.getByRole('button', { name: 'Retry' }).getAttribute('data-variant')).toBe(
      'secondary',
    );
    expect(
      alert.compareDocumentPosition(screen.getByRole('button', { name: 'Retry' })) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeGreaterThan(0);
  });

  it('copies the details of another start failure', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    mount({ name: 'u34-u12-failure' });
    fireEvent.click(screen.getByRole('button', { name: 'Copy details' }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith('The payments-api project could not be opened.'),
    );
  });
});
