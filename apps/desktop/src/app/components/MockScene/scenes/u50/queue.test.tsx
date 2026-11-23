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
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { sceneInvoke, clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { liveMounts } from '../../../../../features/overlap/liveMounts';
import { U50_QUEUE_SCENES } from './queue';

beforeAll(async () => {
  installFakeResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  window.localStorage.clear();
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
  liveMounts.reset();
});

type Params = { readonly name: string };

const show = async ({ name }: Params): Promise<HTMLElement> => {
  const Scene = U50_QUEUE_SCENES[name];
  if (Scene === undefined) {
    throw new Error('Unknown queue scene');
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  return screen.findByRole('region', { name: 'Needs you' });
};

describe('the u50 queue scenes', () => {
  it('registers every scene key', () => {
    expect(Object.keys(U50_QUEUE_SCENES)).toEqual([
      'u50-queue-light',
      'u50-queue-dark',
      'u50-queue-clear-light',
      'u50-queue-clear-dark',
    ]);
  });

  it('opens the Board on the Queue with the question to answer in place', async () => {
    const needsYou = await show({ name: 'u50-queue-light' });
    expect(screen.getByRole('tab', { name: 'Queue' }).getAttribute('aria-selected')).toBe('true');
    within(needsYou).getByRole('button', { name: 'Keep five minutes' });
    screen.getByRole('region', { name: 'Running' });
    screen.getByRole('region', { name: 'Ready to merge' });
  });

  it('marks the running session that waits on an overlap, once', async () => {
    await show({ name: 'u50-queue-dark' });
    const running = screen.getByRole('region', { name: 'Running' });

    const chip = await within(running).findByRole('button', { name: /^Overlaps/ });

    expect(within(running).getAllByRole('button', { name: /^Overlaps/ })).toHaveLength(1);
    fireEvent.click(chip);
    within(screen.getByRole('dialog', { name: 'Overlap' })).getByRole('button', {
      name: 'Message both Implementers',
    });
  });

  it('says nothing waits on you when the pile is clear', async () => {
    const needsYou = await show({ name: 'u50-queue-clear-dark' });
    within(needsYou).getByText('Nothing waits on you.');
  });
});
