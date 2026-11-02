// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { brandId, type WorkflowRunId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { PresetRunPage } from '.';

const RUN_ID = brandId<WorkflowRunId>({ value: 'run-harborline' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const advance = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

describe('PresetRunPage load state', () => {
  it('draws the run skeleton from 120 ms while the workflows load, then nothing if the run is gone', () => {
    const session = aSession();
    render(<PresetRunPage session={session} focus={{ runId: RUN_ID, agentId: null }} />);

    expect(screen.queryByRole('status', { name: 'Loading run' })).toBeNull();

    advance(130);
    screen.getByRole('status', { name: 'Loading run' });
    expect(screen.getAllByRole('status', { name: 'Loading steps' })).toHaveLength(3);

    act(() => {
      useAppStore.setState({ sessionWorkflows: { [session.id]: [] } });
    });
    advance(200);
    advance(200);
    expect(screen.queryByRole('status', { name: 'Loading run' })).toBeNull();
  });

  it('draws no skeleton when the workflows are already loaded and the run is missing', () => {
    const session = aSession();
    useAppStore.setState({ sessionWorkflows: { [session.id]: [] } });

    render(<PresetRunPage session={session} focus={{ runId: RUN_ID, agentId: null }} />);
    advance(300);

    expect(screen.queryByRole('status', { name: 'Loading run' })).toBeNull();
  });
});
