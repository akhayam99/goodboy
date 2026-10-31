// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

type Read = { readonly dir: string; readonly relPath: string };

const { reads } = vi.hoisted<{ reads: Read[] }>(() => ({ reads: [] }));

vi.mock('../../turn', async () => ({
  ...(await import('../../../../store/storyHarness')).turnModuleMock(),
  readAttachment: async (dir: string, relPath: string) => {
    reads.push({ dir, relPath });
    return 'data:image/png;base64,QUJD';
  },
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { MessageAttachment } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../store/storyHarness';
import { UserText } from './UserText';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  reads.length = 0;
  await resetStoryStore();
});

afterEach(cleanup);

const SHOT: MessageAttachment = {
  id: 'att-1',
  kind: 'image',
  fileName: 'checkout-502.png',
  mimeType: 'image/png',
  relPath: '.goodboy/attachments/att-1-checkout-502.png',
};

const PROJECT_ROOT = '/Users/mara/code/cascadia';
const SCRATCH = '/tmp/goodboy/scratch/session-1';

describe('UserText attachments', () => {
  it('shows the image as a thumbnail read from the working folder', async () => {
    render(
      <UserText
        text="Why the 502?"
        at="2026-10-03T09:00:00.000Z"
        attachments={[SHOT]}
        workingDir={PROJECT_ROOT}
      />,
    );
    const thumb = await screen.findByRole('button', { name: 'Preview checkout-502.png' });
    await waitFor(() =>
      expect(thumb.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,QUJD'),
    );
    expect(reads).toEqual([{ dir: PROJECT_ROOT, relPath: SHOT.relPath }]);
  });

  it('reads a first lap image from the folder it was written to', async () => {
    render(
      <UserText
        text="Why the 502?"
        at="2026-10-03T09:00:00.000Z"
        attachments={[{ ...SHOT, dir: SCRATCH }]}
        workingDir={PROJECT_ROOT}
      />,
    );
    await screen.findByRole('button', { name: 'Preview checkout-502.png' });
    await waitFor(() => expect(reads).toEqual([{ dir: SCRATCH, relPath: SHOT.relPath }]));
  });

  it('reads a first lap image even when the session has no working folder', async () => {
    render(
      <UserText
        text="Why the 502?"
        at="2026-10-03T09:00:00.000Z"
        attachments={[{ ...SHOT, dir: SCRATCH }]}
        workingDir={null}
      />,
    );
    await screen.findByRole('button', { name: 'Preview checkout-502.png' });
    await waitFor(() => expect(reads).toEqual([{ dir: SCRATCH, relPath: SHOT.relPath }]));
  });
});
