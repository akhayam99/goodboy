// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
const { renameSession } = vi.hoisted(() => ({
  renameSession: vi.fn(async (..._args: ReadonlyArray<unknown>): Promise<void> => undefined),
}));
vi.mock('@goodboy/db', async () =>
  (await import('../../../../store/storyHarness')).dbModuleMock({ renameSession }),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { requestRename } from '../../../actions/renameRequest';
import { sessionObjectKey } from '../../../actions/kinds/session';
import { renderBar, seedColumn, sessionOf } from '../../testing/sessionColumn';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
  renameSession.mockReset();
  renameSession.mockResolvedValue(undefined);
});

afterEach(cleanup);

const webhook = sessionOf({
  goal: 'Fix webhook retries',
  lastOpenedAt: '2026-10-06T09:00:00.000Z',
});
const webhookId: SessionId = webhook.id;

const askToRename = () =>
  act(() => {
    requestRename({
      objectKey: sessionObjectKey({ sessionId: webhookId }),
      anchorKey: `sidebar:${webhookId}`,
    });
  });

const field = () => screen.getByRole<HTMLInputElement>('textbox', { name: 'Session title' });

describe('the sidebar row rename', () => {
  it('uses the compact title field with the limit ring and no leading state node', () => {
    seedColumn({ store: useAppStore, sessions: [webhook] });
    renderBar();
    askToRename();

    expect(field().value).toBe('Fix webhook retries');
    expect(field().maxLength).toBe(120);
    expect(field().closest('[data-title-field]')?.getAttribute('data-title-field')).toBe('row');
    expect(field().closest('[data-title-field]')?.querySelector('[data-node-kind]')).toBeNull();
    const ring = screen.getByRole('img', { name: '19 of 120 characters' });
    expect(ring.hasAttribute('data-near-limit')).toBe(false);

    fireEvent.change(field(), { target: { value: 'x'.repeat(110) } });
    expect(
      screen.getByRole('img', { name: '110 of 120 characters' }).hasAttribute('data-near-limit'),
    ).toBe(true);
  });

  it('gives up the listbox while a title field sits in it, and takes it back after', () => {
    seedColumn({ store: useAppStore, sessions: [webhook] });
    renderBar();
    expect(screen.getAllByRole('listbox')).toHaveLength(1);
    askToRename();

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.queryByRole('option')).toBeNull();

    fireEvent.keyDown(field(), { key: 'Escape' });
    expect(screen.getAllByRole('listbox')).toHaveLength(1);
    expect(screen.getAllByRole('option')).toHaveLength(1);
  });

  it('saves on Enter only after the write lands, and Escape leaves the title alone', async () => {
    seedColumn({ store: useAppStore, sessions: [webhook] });
    renderBar();
    askToRename();
    fireEvent.change(field(), { target: { value: 'Something else' } });
    fireEvent.keyDown(field(), { key: 'Escape' });
    expect(screen.queryByRole('textbox', { name: 'Session title' })).toBeNull();
    expect(renameSession).not.toHaveBeenCalled();

    askToRename();
    fireEvent.change(field(), { target: { value: 'Key webhook retries by event id' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    await waitFor(() =>
      expect(screen.queryByRole('textbox', { name: 'Session title' })).toBeNull(),
    );
    expect(renameSession).toHaveBeenCalledWith(
      expect.anything(),
      webhookId,
      'Key webhook retries by event id',
      expect.any(String),
      true,
    );
    expect(useAppStore.getState().sessions[0]?.goal).toBe('Key webhook retries by event id');
  });

  it('keeps the old title and the field open with the error when the write fails', async () => {
    renameSession.mockRejectedValueOnce(new Error('database is locked'));
    seedColumn({ store: useAppStore, sessions: [webhook] });
    renderBar();
    askToRename();
    fireEvent.change(field(), { target: { value: 'Key webhook retries by event id' } });
    fireEvent.keyDown(field(), { key: 'Enter' });

    expect((await screen.findByRole('alert')).textContent).toContain('database is locked');
    expect(useAppStore.getState().sessions[0]?.goal).toBe('Fix webhook retries');
    expect(field().value).toBe('Key webhook retries by event id');
  });
});
