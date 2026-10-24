// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { aSession } from '@goodboy/types/testing';
import { brandId, type MountId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { ClosingIssueReference } from '../../../integrations/github/closingIssueReferences';
import { LinkIssueToPrPopover } from './LinkIssueToPrPopover';

const SESSION = aSession();
const SHOWN_MOUNT = brandId<MountId>({ value: 'mount-payments-api' });
const ISSUE: ClosingIssueReference = {
  number: 204,
  identifier: '#204',
  title: 'Retried settlements credit the account twice',
  url: 'https://github.com/harborline/payments-api/issues/204',
  line: 'Closes #204',
};

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const open = () => {
  render(
    <LinkIssueToPrPopover
      sessionId={SESSION.id}
      mountId={SHOWN_MOUNT}
      prNumber={318}
      body="Guards the retry path."
      candidates={[ISSUE]}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Link issue' }));
};

describe('linking an issue to the pull request on screen', () => {
  it('writes the closing reference through the mount on screen', async () => {
    const editPr = vi.fn(async () => undefined);
    store.setState({ editPr });
    open();

    fireEvent.click(await screen.findByRole('button', { name: /Link issue #204/ }));

    await waitFor(() => expect(editPr).toHaveBeenCalledTimes(1));
    expect(editPr).toHaveBeenCalledWith(SESSION.id, 318, {
      body: 'Guards the retry path.\n\nCloses #204',
      mountId: SHOWN_MOUNT,
    });
  });

  it('keeps the popover open and says why when the host refuses', async () => {
    const editPr = vi.fn(async () => {
      throw new Error('Resource not accessible');
    });
    store.setState({ editPr });
    open();

    fireEvent.click(await screen.findByRole('button', { name: /Link issue #204/ }));

    expect(await screen.findByText(/Resource not accessible/)).toBeDefined();
    screen.getByRole('dialog', { name: 'Link an issue to this pull request' });
  });
});
