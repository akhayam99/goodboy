// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U23_OVERVIEW_SCENES } from './overview';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const SCENE_IDS = ['overview-mount-mismatch', 'overview-header-provenance'] as const;

const renderScene = (id: (typeof SCENE_IDS)[number]) => {
  const Scene = U23_OVERVIEW_SCENES[id];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const WAIT = { timeout: 4000 };

describe('the u23 overview scenes', () => {
  it('registers exactly the scenes the plan names, in the capture registry', () => {
    expect(Object.keys(U23_OVERVIEW_SCENES).sort()).toEqual([...SCENE_IDS].sort());
    SCENE_IDS.forEach((id) => expect(MOCK_SCENES[id]).toBe(U23_OVERVIEW_SCENES[id]));
  });

  it('overview-mount-mismatch shows the decision as a warning notice with three buttons', async () => {
    renderScene('overview-mount-mismatch');

    const notice = await screen.findByRole('alert', {}, WAIT);
    expect(notice.getAttribute('data-tone')).toBe('warning');
    const names = within(notice)
      .getAllByRole('button')
      .map((button) => button.textContent);
    expect(names).toHaveLength(3);
    expect(names[0]).toBe('Use this branch here');
    expect(names[2]).toBe('Not now');
  });

  it('overview-header-provenance names one chat on one line and keeps the rest behind +2 more', async () => {
    renderScene('overview-header-provenance');

    const line = await screen.findByRole(
      'button',
      { name: /From chat: Payments retry design/ },
      WAIT,
    );
    expect(line.textContent).not.toContain('·');
    const popover = await screen.findByRole('dialog', { name: 'Other chats' }, WAIT);
    expect(
      within(popover)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['From chat: Ledger rounding', 'From chat: Relay backoff notes']);
    fireEvent.keyDown(popover, { key: 'Escape' });
  });
});
