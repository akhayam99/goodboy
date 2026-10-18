// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U26S_IMPACT_SCENES } from './ImpactScene';

const WAIT = { timeout: 15_000 };

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

type SceneId = keyof typeof U26S_IMPACT_SCENES;

const mount = ({ id }: { readonly id: SceneId }): void => {
  const Scene = U26S_IMPACT_SCENES[id];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the secondary Impact scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(U26S_IMPACT_SCENES).sort()).toEqual([
      'u26s-impact-empty',
      'u26s-impact-overview',
      'u26s-impact-spend',
    ]);
    expect(MOCK_SCENES['u26s-impact-spend']).toBe(U26S_IMPACT_SCENES['u26s-impact-spend']);
  });

  it('overview names the range, the sessions done and what the range spent', async () => {
    mount({ id: 'u26s-impact-overview' });

    expect(
      await screen.findByText(/^30 days · 14 sessions done · \$[\d.]+ spent$/, {}, WAIT),
    ).toBeDefined();
    expect(screen.queryByText(/What Goodboy got done/)).toBeNull();
  });

  it('spend shows Claude this month, the Monthly limit and By model', async () => {
    mount({ id: 'u26s-impact-spend' });

    expect(await screen.findByText('Claude this month', {}, WAIT)).toBeDefined();
    expect(screen.getByText('Spent this month')).toBeDefined();
    expect(screen.getByText('$152.37')).toBeDefined();
    expect(screen.getByText('$170.00')).toBeDefined();
    expect(screen.getByText('$17.63')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Save limit' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Remove limit' })).toBeDefined();
    expect(screen.getByText('By model')).toBeDefined();
    expect(screen.getByRole('button', { name: 'How cost is counted, in the Guide' })).toBeDefined();
    expect(screen.queryByText(/\bcap\b/i)).toBeNull();
  });

  it('empty is one EmptyState that says what fills Impact', async () => {
    mount({ id: 'u26s-impact-empty' });

    expect(
      await screen.findByRole('heading', { name: 'Nothing finished yet' }, WAIT),
    ).toBeDefined();
    expect(screen.getByText('0 sessions done')).toBeDefined();
    const empty = screen.getByRole('heading', { name: 'Nothing finished yet' }).closest('div');
    expect(
      within(empty?.parentElement ?? document.body).getByRole('button', { name: 'New session' }),
    ).toBeDefined();
  });
});
