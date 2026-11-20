// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { brandId, type SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { HostReviewNotice } from './index';

const SESSION_ID = brandId<SessionId>({ value: 'session-notify-relay' });
const URL = 'https://bitbucket.org/harborline/notify-relay/pull-requests/205';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('Write review on a Bitbucket branch', () => {
  it('says the review is written on Bitbucket and offers to open the pull request there', () => {
    render(<HostReviewNotice sessionId={SESSION_ID} url={URL} />);

    screen.getByText('Bitbucket reviews are written on Bitbucket.');
    screen.getByRole('button', { name: 'Open on Bitbucket' });
    expect(screen.queryByRole('button', { name: /^Submit/ })).toBeNull();
  });

  it('keeps only the line when the pull request has no link', () => {
    render(<HostReviewNotice sessionId={SESSION_ID} url={null} />);

    screen.getByText('Bitbucket reviews are written on Bitbucket.');
    expect(screen.queryByRole('button', { name: 'Open on Bitbucket' })).toBeNull();
  });
});
