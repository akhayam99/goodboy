// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { resetWorktreeStatusCache } from '../../../../../store/runtime/worktreeStatuses/cache';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { sceneInvoke, clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { U50_SEND_TO_LEAD_SCENES } from './sendToLead';

beforeAll(async () => {
  installFakeResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  window.localStorage.clear();
  await resetStoryStore();
  resetWorktreeStatusCache();
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
  const Scene = U50_SEND_TO_LEAD_SCENES[name];
  if (Scene === undefined) {
    throw new Error('Unknown send to lead scene');
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

const WAIT = { timeout: 5000 };

describe('the u50 send to lead scenes', () => {
  it('registers a dark and a light scene for every state', () => {
    expect(Object.keys(U50_SEND_TO_LEAD_SCENES)).toHaveLength(10);
  });

  it('offers Send to Lead on the failed check with one obvious Lead', async () => {
    show({ name: 'u50-send-to-lead-one-light' });

    expect(await screen.findByRole('button', { name: 'Send to Lead' }, WAIT)).toBeDefined();
  });

  it('offers Start new Lead when no Lead is open', async () => {
    show({ name: 'u50-send-to-lead-none-dark' });

    expect(await screen.findByRole('button', { name: 'Start new Lead' }, WAIT)).toBeDefined();
  });

  it('opens the short choice with two Leads and Start new Lead', async () => {
    show({ name: 'u50-send-to-lead-pick-light' });

    const picker = await screen.findByRole('dialog', { name: 'Send to which Lead?' }, WAIT);
    expect(picker.querySelectorAll('li')).toHaveLength(3);
  });

  it('turns the Move into the quiet row after the send, with Edit and Undo', async () => {
    show({ name: 'u50-send-to-lead-sent-dark' });

    expect(
      await screen.findByText('The Lead of HBL-417 has it · Not read yet', {}, WAIT),
    ).toBeDefined();
    screen.getByRole('button', { name: 'Edit' });
    screen.getByRole('button', { name: 'Undo' });
  });

  it('says Not delivered with Start new Lead when the Lead stopped', async () => {
    show({ name: 'u50-send-to-lead-stopped-light' });

    expect(await screen.findByText('Not delivered: the Lead stopped', {}, WAIT)).toBeDefined();
    screen.getByRole('button', { name: 'Start new Lead' });
  });
});
