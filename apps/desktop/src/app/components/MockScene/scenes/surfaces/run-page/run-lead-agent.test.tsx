// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../../../../../test/sceneInvoke';
import { RUN_LEAD_AGENT_SCENES } from './run-lead-agent';

const SETTLE_MS = 2_000;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command, args) =>
    sceneInvoke({ command: String(command), args }),
  );
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

const mount = async (): Promise<HTMLElement> => {
  const Scene = RUN_LEAD_AGENT_SCENES['run-page-lead-agent'];
  const { container } = render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
  return container;
};

describe('the lead agent page scene', () => {
  it('keeps the Agents rail on the left and lists what went in at the top of the transcript', async () => {
    const container = await mount();

    const lead = container.querySelector<HTMLElement>('[data-session-lead]');
    if (lead === null) {
      throw new Error('no [data-session-lead]');
    }
    within(lead).getByRole('complementary', { name: 'Agents' });
    expect(container.querySelector('[data-session-aside]')?.childElementCount ?? 0).toBe(0);
    const facts = screen.getByRole('region', { name: 'Why the Lead started it' });
    const given = within(facts).getByRole('list', { name: 'Given to the agent' });
    expect(within(given).getAllByRole('listitem')).toHaveLength(4);
    within(given).getByText(/your note, read at turn 4/);
    within(given).getByText(/plan, version 2/);
    expect(within(facts).queryByRole('list', { name: 'Images the Lead passed on' })).toBeNull();
  });
});
