// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
} from '../../../../../store/storyHarness';
import { U28_AGENT_STATE_SCENES } from './agent-state';

const WAIT = { timeout: 15_000 };

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ db_select: [], db_execute: { rowsAffected: 0 } });
});

afterEach(cleanup);

describe('u28 agent state scene', () => {
  it('lists what needs you first and files stopped agents under Idle', async () => {
    const Scene = U28_AGENT_STATE_SCENES['u28-agent-state-runs'];
    if (Scene === undefined) {
      throw new Error('no scene');
    }
    render(
      <ToastProvider>
        <Scene />
      </ToastProvider>,
    );

    const needsYou = await screen.findByRole('list', { name: 'Needs you' }, WAIT);
    const idle = screen.getByRole('list', { name: 'Idle' });
    const labels = within(needsYou)
      .getAllByRole('button')
      .map((row) => row.getAttribute('aria-label'));
    const idleLabels = within(idle)
      .getAllByRole('button')
      .map((row) => row.getAttribute('aria-label'));

    expect(labels[0]).toMatch(
      /^Open Run the settlement suite in ledger-core, Agent, Needs permission/,
    );
    expect(labels[1]).toMatch(/^Open Tidy the Cascadia fixtures, Agent, Blocked/);
    expect(idleLabels.filter((label) => label?.endsWith(', Stopped') === true)).toHaveLength(2);
    screen.getByRole('button', { name: 'Continue all' });
  });
});
