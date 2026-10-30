// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { brandId, type AgentId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import { STORE_IMPORT_TIMEOUT_MS, importStore, resetStoryStore } from '../../../store/storyHarness';
import { registerTreeStopPort } from '../treeStopPort';
import { aDelegation, aView, FIXTURE_SESSION } from '../testing/autoViewFixtures';
import { AutoTail } from './AutoTail';

const ROOT = anAgent({
  id: brandId<AgentId>({ value: 'agent-auto' }),
  sessionId: FIXTURE_SESSION,
  name: 'Auto',
  status: 'running',
  kind: 'custom',
});

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  registerTreeStopPort({ port: null });
});

describe('the Auto tail verbs', () => {
  it('has Change approach and no Stop while Auto waits for its agents', () => {
    const view = aView({
      phase: 'waiting',
      delegations: [aDelegation({ key: 'impl', role: 'implementer', state: 'running' })],
    });
    render(<AutoTail sessionId={FIXTURE_SESSION} view={view} rootAgent={ROOT} />);

    screen.getByRole('button', { name: 'Change approach' });
    expect(screen.queryByRole('button', { name: /^Stop/ })).toBeNull();
  });

  it('keeps one plain Stop where nothing else stops Auto, with or without agents', async () => {
    const stop = vi.fn(async () => 'stopped' as const);
    registerTreeStopPort({ port: stop });
    const view = aView({
      phase: 'delegating',
      delegations: [aDelegation({ key: 'impl', role: 'implementer', state: 'starting' })],
    });
    render(<AutoTail sessionId={FIXTURE_SESSION} view={view} rootAgent={ROOT} />);

    expect(screen.queryByRole('button', { name: 'Stop Auto and its agents' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));

    await waitFor(() => expect(stop).toHaveBeenCalledWith({ treeId: view.tree.id }));
  });
});
