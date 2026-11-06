// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  brandId,
  type IsoDateTime,
  type SessionExternalTask,
  type SessionExternalTaskProvider,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import { importStore, resetStoryStore, type StoryStore } from '../../../../../store/storyHarness';
import { LinkedTaskRow } from '.';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
const SESSION_ID = brandId<SessionId>({ value: 'session-harborline' });
const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const PROVIDERS: ReadonlyArray<SessionExternalTaskProvider> = [
  'linear',
  'github',
  'gitlab',
  'jira',
  'slack',
  'sentry',
  'bitbucket',
];
let store: StoryStore;
beforeAll(async () => {
  store = await importStore();
});
beforeEach(async () => {
  await resetStoryStore();
  store.setState({
    sessions: [aSession({ id: SESSION_ID, workspaceId: WORKSPACE_ID })],
    currentWorkspaceId: WORKSPACE_ID,
    currentSessionId: SESSION_ID,
  });
});
afterEach(cleanup);

describe('Linked work row', () => {
  it.each(PROVIDERS)('names the %s destination before opening it', (provider) => {
    const task: SessionExternalTask = {
      sessionId: SESSION_ID,
      provider,
      externalId: '42',
      identifier: 'HAR-42',
      title: 'Keep the retry record',
      url: 'https://example.test/harborline/42',
      createdAt: brandId<IsoDateTime>({ value: '2026-11-01T09:00:00.000Z' }),
    };
    const opened = vi.fn();
    window.addEventListener('goodboy:open-inbox', opened);
    render(<LinkedTaskRow sessionId={SESSION_ID} task={task} branches={[]} isShown={false} />);
    fireEvent.click(
      screen.getByRole('button', {
        name: provider === 'sentry' ? 'Open HAR-42 in Tasks' : 'Open HAR-42',
      }),
    );
    if (provider === 'sentry') {
      screen.getByText('Open in Tasks');
      expect(opened).toHaveBeenCalledOnce();
    }
    if (provider !== 'sentry' && provider !== 'github' && provider !== 'bitbucket') {
      expect(store.getState().focusedExternalTask[SESSION_ID]?.provider).toBe(provider);
    }
    if (provider === 'github') {
      expect(store.getState().focusedGithubIssueNumber[SESSION_ID]).toBe(42);
    }
    window.removeEventListener('goodboy:open-inbox', opened);
  });

  it('gives two Sentry rows their own names', () => {
    const base: SessionExternalTask = {
      sessionId: SESSION_ID,
      provider: 'sentry',
      externalId: '1',
      identifier: 'LEDGER-1',
      title: 'Timeout in ledger sync',
      url: 'https://example.test/harborline/1',
      createdAt: brandId<IsoDateTime>({ value: '2026-11-01T09:00:00.000Z' }),
    };
    render(
      <>
        <LinkedTaskRow sessionId={SESSION_ID} task={base} branches={[]} isShown={false} />
        <LinkedTaskRow
          sessionId={SESSION_ID}
          task={{ ...base, externalId: '2', identifier: 'LEDGER-2' }}
          branches={[]}
          isShown={false}
        />
      </>,
    );
    screen.getByRole('button', { name: 'Open LEDGER-1 in Tasks' });
    screen.getByRole('button', { name: 'Open LEDGER-2 in Tasks' });
  });
});
