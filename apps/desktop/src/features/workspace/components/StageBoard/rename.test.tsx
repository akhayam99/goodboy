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
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { aProject, aSession, aWorkspace } from '@goodboy/types/testing';
import type { Session, SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import { requestRename } from '../../../../shared/utils/renameRequest';
import { brandedId } from '../../../history/testing/brandedId';
import { sessionObjectKey } from '../../../actions/kinds/session';
import { StageBoard } from './index';

const workspace = aWorkspace({ name: 'Harborline', slug: 'harborline' });
const project = aProject({ workspaceId: workspace.id, name: 'ledger-core', kind: 'folder' });
const webhook: Session = aSession({ workspaceId: workspace.id, goal: 'Fix webhook retries' });
const other: Session = aSession({ workspaceId: workspace.id, goal: 'Rate-limit the payout API' });
const webhookId = brandedId<SessionId>({ value: webhook.id });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
  renameSession.mockReset();
  renameSession.mockResolvedValue(undefined);
  useAppStore.setState({
    workspaces: [workspace],
    projects: [project],
    sessions: [webhook, other],
    archivedSessions: { [workspace.id]: [] },
    boardReady: true,
    currentWorkspaceId: workspace.id,
  });
  render(
    <ToastProvider>
      <StageBoard workspaceId={workspace.id} sessions={[webhook, other]} />
    </ToastProvider>,
  );
});

afterEach(cleanup);

const askToRename = () =>
  act(() => {
    requestRename({
      objectKey: sessionObjectKey({ sessionId: webhookId }),
      anchorKey: `board:${webhook.id}`,
    });
  });

const field = () => screen.getByRole<HTMLInputElement>('textbox', { name: 'Session title' });

const goalOf = (): string | undefined =>
  useAppStore.getState().sessions.find((session) => session.id === webhook.id)?.goal;

describe('StageBoard card rename', () => {
  it('opens one title field on the named card only', () => {
    askToRename();
    expect(screen.getAllByRole('textbox', { name: 'Session title' })).toHaveLength(1);
    expect(field().value).toBe('Fix webhook retries');
    screen.getByRole('button', { name: 'Rate-limit the payout API' });
  });

  it('saves on Enter only after the write lands, and Escape leaves the title alone', async () => {
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
    expect(renameSession).toHaveBeenCalledTimes(1);
    expect(goalOf()).toBe('Key webhook retries by event id');
  });

  it('keeps the old title and the field open with the error when the write fails, and retries', async () => {
    renameSession.mockRejectedValueOnce(new Error('database is locked'));
    askToRename();
    fireEvent.change(field(), { target: { value: 'Key webhook retries by event id' } });
    fireEvent.keyDown(field(), { key: 'Enter' });

    expect((await screen.findByRole('alert')).textContent).toContain('database is locked');
    expect(goalOf()).toBe('Fix webhook retries');
    expect(field().value).toBe('Key webhook retries by event id');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });
    await waitFor(() =>
      expect(screen.queryByRole('textbox', { name: 'Session title' })).toBeNull(),
    );
    expect(renameSession).toHaveBeenCalledTimes(2);
    expect(goalOf()).toBe('Key webhook retries by event id');
  });

  it('keeps the field when it is clicked', () => {
    askToRename();
    fireEvent.click(field());
    expect(field()).toBeDefined();
  });

  it('gives up an empty title on blur and writes nothing', () => {
    askToRename();
    fireEvent.change(field(), { target: { value: '   ' } });
    fireEvent.blur(field());
    expect(screen.queryByRole('textbox', { name: 'Session title' })).toBeNull();
    expect(renameSession).not.toHaveBeenCalled();
  });

  it('says Saving while the write runs, on the card', async () => {
    let finish: () => void = () => undefined;
    renameSession.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    askToRename();
    fireEvent.change(field(), { target: { value: 'Key webhook retries by event id' } });
    fireEvent.keyDown(field(), { key: 'Enter' });

    expect((await screen.findByRole('status')).textContent).toBe('Saving');
    expect(field().getAttribute('aria-busy')).toBe('true');
    await act(async () => {
      finish();
    });
    await waitFor(() =>
      expect(screen.queryByRole('textbox', { name: 'Session title' })).toBeNull(),
    );
  });

  it('shows a refused name with its reason and no Retry, and writes nothing', async () => {
    askToRename();
    fireEvent.change(field(), { target: { value: 'x'.repeat(200) } });
    await act(async () => {
      fireEvent.keyDown(field(), { key: 'Enter' });
    });

    expect(screen.getByRole('alert').textContent).toContain('name is too long');
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(renameSession).not.toHaveBeenCalled();
  });
});
