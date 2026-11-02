// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U34_LONG_TRANSCRIPT_SCENES } from './long-transcript';
import {
  LONG_TRANSCRIPT_AGENT_ID,
  LONG_TRANSCRIPT_PERF_ROWS,
  LONG_TRANSCRIPT_ROWS,
  longTranscriptRows,
} from './longTranscriptSeed';

const SCENE = 'u34-t52-long-transcript';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ db_select: [], db_execute: { rowsAffected: 0 } });
});

afterEach(cleanup);

describe('the u34 long transcript scene', () => {
  it('registers the scene for the capture', () => {
    expect(MOCK_SCENES[SCENE]).toBe(U34_LONG_TRANSCRIPT_SCENES[SCENE]);
  });

  it('seeds a light transcript for the scan and a 3000 row one for the perf run', () => {
    expect(longTranscriptRows({ count: LONG_TRANSCRIPT_ROWS })).toHaveLength(300);
    expect(longTranscriptRows({ count: LONG_TRANSCRIPT_PERF_ROWS })).toHaveLength(3000);
  });

  it('mounts the chat over the seeded transcript and records the mount cost', async () => {
    const Scene = U34_LONG_TRANSCRIPT_SCENES[SCENE];
    const startedAt = performance.now();
    await act(async () => {
      render(
        <ToastProvider>
          <Scene rowCount={LONG_TRANSCRIPT_PERF_ROWS} />
        </ToastProvider>,
      );
    });
    const mountMs = performance.now() - startedAt;
    const rows = useAppStore.getState().transcripts[LONG_TRANSCRIPT_AGENT_ID] ?? [];
    expect(rows).toHaveLength(LONG_TRANSCRIPT_PERF_ROWS);
    process.stdout.write(`[perf] u34-t52 mount ${mountMs.toFixed(0)}ms (${rows.length} rows)\n`);
  });
});
