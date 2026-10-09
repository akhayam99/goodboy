// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { U21_CHECKS_SCENES } from './checks';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

type SceneName = keyof typeof U21_CHECKS_SCENES;

const draw = ({ name }: { readonly name: SceneName }) => {
  const Scene = U21_CHECKS_SCENES[name];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the checks scenes', () => {
  it('registers the six scenes of the plan', () => {
    expect(Object.keys(U21_CHECKS_SCENES).sort()).toEqual([
      'branch-checks',
      'branch-checks-denied',
      'branch-checks-empty',
      'branch-checks-failing',
      'branch-checks-loading',
      'branch-checks-no-pr',
    ]);
  });

  it('branch-checks reads one rollup line with everything passing', async () => {
    draw({ name: 'branch-checks' });

    expect((await screen.findByTestId('checks-rollup')).textContent).toBe('7 passed · 1 skipped');
  });

  it('branch-checks-failing leads with the failures', async () => {
    draw({ name: 'branch-checks-failing' });

    expect((await screen.findByTestId('checks-rollup')).textContent).toBe(
      '2 failing · 1 running · 5 passed · 1 skipped',
    );
    expect(screen.getByRole('list', { name: 'Failing checks' })).toBeDefined();
  });

  it('branch-checks-denied says what the access cannot read and keeps the command', async () => {
    draw({ name: 'branch-checks-denied' });

    expect(await screen.findByText("Goodboy can't read checks for payments-api")).toBeDefined();
    expect(screen.getByText('gh auth refresh -s repo')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Check again' })).toBeDefined();
  });

  it('branch-checks-empty says nothing has reported yet', async () => {
    draw({ name: 'branch-checks-empty' });

    expect(
      await screen.findByText('No checks have reported on this pull request yet'),
    ).toBeDefined();
  });

  it('branch-checks-no-pr waits for the pull request', async () => {
    draw({ name: 'branch-checks-no-pr' });

    expect(await screen.findByText('Checks run once the pull request exists')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Create pull request' })).toBeDefined();
  });

  it('branch-checks-loading reads the checks and stays there', async () => {
    draw({ name: 'branch-checks-loading' });

    expect((await screen.findByRole('status')).textContent).toBe('Reading checks');
    expect(screen.queryByText(/No checks have reported/)).toBeNull();
  });
});
