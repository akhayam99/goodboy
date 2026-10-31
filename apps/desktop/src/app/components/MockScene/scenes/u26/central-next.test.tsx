// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { sceneInvoke, clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { U26_CENTRAL_NEXT_SCENES } from './central-next';

beforeAll(async () => {
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
});

type Params = { readonly name: string };
const show = ({ name }: Params) => {
  const Scene = U26_CENTRAL_NEXT_SCENES[name];
  if (Scene === undefined) {
    throw new Error('Unknown central next scene');
  }
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const titlesOf = (): ReadonlyArray<string> =>
  [
    ...screen.getByRole('region', { name: 'Next steps' }).querySelectorAll('[data-action-card]'),
  ].map((card) => card.querySelector('.text-row')?.textContent ?? '');

describe('central next scenes', () => {
  it('groups an answer, a failing check and a rebase in Decide, Fix and Update', () => {
    show({ name: 'u26-central-next-mid-light' });
    const stack = screen.getByRole('region', { name: 'Next steps' });
    expect(
      [...stack.querySelectorAll<HTMLElement>('[data-next-group]')].map(
        (group) => group.dataset.nextGroup,
      ),
    ).toEqual(['decide', 'fix', 'update']);
    expect(titlesOf()).toEqual([
      'Cap per day or per payout?',
      'Fix the failing static-analysis check',
      'Rebase payments-api on main',
    ]);
    screen.getByRole('button', { name: 'Answer' });
    screen.getByRole('button', { name: 'Open check' });
    screen.getByRole('button', { name: 'Fix' });
  });

  it('leads with a Fixer that never started and offers Open Auto beside the retry', () => {
    show({ name: 'u26-central-next-stuck-dark' });
    expect(titlesOf()[0]).toBe('Auto is stuck');
    const first = screen.getAllByTestId(/^action-card-/)[0];
    if (first === undefined) {
      throw new Error('Expected a card');
    }
    expect(within(first).getByRole('button', { name: 'Retry "Fixer"' }).dataset.variant).toBe(
      'primary',
    );
    within(first).getByRole('button', { name: 'Open Auto' });
  });

  it('shows one card with Mark ready as the primary when only that is left', () => {
    show({ name: 'u26-central-next-done-light' });
    expect(titlesOf()).toEqual(['Mark #309 ready for review']);
    expect(screen.getByRole('button', { name: 'Mark ready' }).dataset.variant).toBe('primary');
  });

  it('keeps the overflow of a card and opens Not now from it', () => {
    show({ name: 'u26-central-next-done-dark' });
    fireEvent.click(
      screen.getByRole('button', { name: 'More options for Mark #309 ready for review' }),
    );
    screen.getByRole('menuitem', { name: 'Not now' });
  });

  it('registers a light and a dark shot for each moment and one narrow shot', () => {
    expect(Object.keys(U26_CENTRAL_NEXT_SCENES)).toEqual([
      'u26-central-next-mid-light',
      'u26-central-next-mid-dark',
      'u26-central-next-stuck-light',
      'u26-central-next-stuck-dark',
      'u26-central-next-done-light',
      'u26-central-next-done-dark',
      'u26-central-next-narrow-light',
    ]);
  });

  it.each(Object.keys(U26_CENTRAL_NEXT_SCENES))(
    '%s has no accessibility violations',
    async (name) => {
      const { container } = show({ name });
      const { violations } = await runA11yCheck(container);
      expect(violations.map((violation) => violation.id)).toEqual([]);
    },
  );
});
