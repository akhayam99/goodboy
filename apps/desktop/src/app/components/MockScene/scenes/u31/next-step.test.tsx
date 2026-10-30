// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  registerDelegationDecisionPort,
  type DelegationDecisionPort,
} from '../../../../../features/auto/delegationDecisionPort';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { clearSceneInvoke, sceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U31_NEXT_STEP_SCENES } from './next-step';

const WAIT = { timeout: 15_000 };

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
  registerDelegationDecisionPort({ port: null });
  localStorage.clear();
});

const mount = () => {
  const Scene = U31_NEXT_STEP_SCENES['u31-next-step'];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the next step scene', () => {
  it('registers the scene for the capture', () => {
    expect(Object.keys(U31_NEXT_STEP_SCENES)).toEqual(['u31-next-step']);
    expect(MOCK_SCENES['u31-next-step']).toBe(U31_NEXT_STEP_SCENES['u31-next-step']);
  });

  it('frames the capture on one element whose padding sits on an inner element', async () => {
    const { container } = mount();

    await screen.findByRole('region', { name: 'Next step' }, WAIT);
    const frames = container.querySelectorAll<HTMLElement>('[data-shot]');
    expect(frames).toHaveLength(1);
    const frame = frames[0];
    expect(frame?.style.width).toBe('680px');
    expect(frame?.style.padding).toBe('');
    expect(frame?.children).toHaveLength(1);
  });

  it('shows one compact neutral card: a dot, one row of choices, a hint on demand, one primary', async () => {
    mount();

    const card = await screen.findByRole('region', { name: 'Next step' }, WAIT);
    expect(within(card).getAllByRole('option')).toHaveLength(3);
    expect(within(card).getAllByText('Recommended')).toHaveLength(1);
    expect(within(card).queryByRole('textbox', { name: 'Add a hint' })).toBeNull();
    expect(
      within(card)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Not now', 'Add a hint', expect.any(String)]);
    expect(card.querySelectorAll('[data-testid="tone-bar"]')).toHaveLength(0);
    expect(card.querySelectorAll('.bg-warning')).toHaveLength(1);
  });

  it('holds three rows while the hint is closed and a fourth once it is open', async () => {
    mount();

    const card = await screen.findByRole('region', { name: 'Next step' }, WAIT);
    expect([...card.children].map((row) => row.getAttribute('role') ?? row.tagName)).toEqual([
      'DIV',
      'listbox',
      'DIV',
    ]);
    fireEvent.click(within(card).getByRole('button', { name: 'Add a hint' }));
    expect(card.children).toHaveLength(4);
  });

  it('opens the hint field from Add a hint and keeps the card to the same rows', async () => {
    mount();

    const card = await screen.findByRole('region', { name: 'Next step' }, WAIT);
    fireEvent.click(within(card).getByRole('button', { name: 'Add a hint' }));

    within(card).getByRole('textbox', { name: 'Add a hint' });
    expect(within(card).queryByRole('button', { name: 'Add a hint' })).toBeNull();
  });

  it('declines for Not now through the real control', async () => {
    const port = vi.fn<DelegationDecisionPort>(async () => 'declined');
    registerDelegationDecisionPort({ port });
    mount();

    const card = await screen.findByRole('region', { name: 'Next step' }, WAIT);
    fireEvent.click(within(card).getByRole('button', { name: 'Not now' }));

    await waitFor(() =>
      expect(port).toHaveBeenCalledWith(expect.objectContaining({ decision: 'decline' })),
    );
  });
});
