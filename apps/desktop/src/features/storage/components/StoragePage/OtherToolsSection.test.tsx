// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { insertWorkspace } from '@goodboy/db';
import { aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySpies,
  storySqlite,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { OtherToolUsage } from '../../otherTools';
import { OtherToolsSection } from './OtherToolsSection';

const MB = 1024 * 1024;
const HARBORLINE = aWorkspace({ name: 'Harborline', slug: 'harborline' });

let useAppStore: StoryStore;

const CLAUDE: OtherToolUsage = {
  id: 'claude-code',
  path: '/home/mara/.claude',
  displayPath: '~/.claude',
  bytes: 6_100 * MB,
  sessions: 4_405,
  goodboyBytes: 312 * MB,
};

const CURSOR_SMALL: OtherToolUsage = {
  id: 'cursor',
  path: '/home/mara/.cursor',
  displayPath: '~/.cursor',
  bytes: 40 * MB,
  sessions: 12,
  goodboyBytes: 0,
};

const invokes = (command: string): ReadonlyArray<unknown> =>
  storySpies.tauriInvoke.mock.calls
    .filter(([name]) => String(name) === command)
    .map(([, args]) => args);

const seedAgent = async ({
  id,
  providerSessionId,
  providerId,
}: {
  readonly id: string;
  readonly providerSessionId: string;
  readonly providerId: string;
}) => {
  await storySqlite().execute(
    `INSERT INTO agents (
       id, session_id, ordinal, name, status, provider_session_id, provider_session_provider_id
     ) VALUES (?, 'session-ledger', 0, ?, 'completed', ?, ?)`,
    [id, id, providerSessionId, providerId],
  );
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace: HARBORLINE });
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session-ledger', ?, 'Round the ledger', 'idle', 1, 1)",
    [HARBORLINE.id],
  );
  stubStoryInvoke({
    other_tools_scan: { status: 'ready', tools: [CLAUDE, CURSOR_SMALL] },
    other_tools_cancel: null,
    reveal_in_file_manager: null,
  });
});

afterEach(cleanup);

describe('OtherToolsSection', () => {
  it('scans with the session ids Goodboy gave Codex and Cursor and leaves small tools out', async () => {
    await seedAgent({ id: 'agent-a', providerSessionId: 'thread-ledger', providerId: 'codex' });
    await seedAgent({ id: 'agent-b', providerSessionId: 'chat-relay', providerId: 'cursor' });
    render(<OtherToolsSection />);

    const section = screen.getByRole('region', { name: 'Other tools' });
    await within(section).findByText('Claude Code');
    expect(invokes('other_tools_scan')).toEqual([
      { request: { codexThreadIds: ['thread-ledger'], cursorChatIds: ['chat-relay'] } },
    ]);
    within(section).getByText('4,405 sessions');
    within(section).getByText('312 MB from Goodboy sessions');
    expect(within(section).queryByText('Cursor')).toBeNull();
    expect(useAppStore.getState().storageOtherTools.status).toBe('ready');
  });

  it('cancels the scan when you leave the page and keeps what it had', async () => {
    stubStoryInvoke({
      other_tools_scan: { status: 'cancelled' },
      other_tools_cancel: null,
    });
    const { unmount } = render(<OtherToolsSection />);
    await waitFor(() => expect(invokes('other_tools_scan')).toHaveLength(1));

    unmount();

    await waitFor(() => expect(invokes('other_tools_cancel')).toHaveLength(1));
    await waitFor(() => expect(useAppStore.getState().storageOtherTools.status).toBe('idle'));
  });

  it('shows a tool folder in Finder by its full path', async () => {
    render(<OtherToolsSection />);

    fireEvent.click(await screen.findByRole('button', { name: 'Show Claude Code in Finder' }));

    await waitFor(() =>
      expect(invokes('reveal_in_file_manager')).toEqual([{ path: '/home/mara/.claude' }]),
    );
  });
});
