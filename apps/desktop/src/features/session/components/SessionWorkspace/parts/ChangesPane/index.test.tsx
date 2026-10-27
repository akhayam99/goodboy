// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../../store/storyHarness')).dbModuleMock(),
);
vi.mock('../../../../../../shared/lib/db', async () =>
  (await import('../../../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { anAgent, aProject, aSession, aWorkspace } from '@goodboy/types/testing';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type ProviderRunId,
  type SessionId,
} from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../../../store/storyHarness';
import type {
  FolderReadResult,
  FolderRestoreResult,
  FolderTurnManifest,
} from '../../../../../file-versions/fileVersions';
import { testTurn } from '../../../../../file-versions/testing/testTurn';
import { ChangesPane } from './index';

const NOTES_PATH = '/mock/Documents/acme-notes';

const workspace = aWorkspace({ name: 'Acme notes', slug: 'acme-notes' });
const notes = aProject({
  workspaceId: workspace.id,
  name: 'acme-notes',
  rootPath: NOTES_PATH,
  kind: 'folder',
});
const session = aSession({ workspaceId: workspace.id, goal: 'Tighten the launch memo' });
const sessionId: SessionId = session.id;

const MEMO_BEFORE = [
  '# Acme Notes launch memo',
  '',
  'Teams of all sizes who write a lot.',
  '',
].join('\n');
const MEMO_AFTER = [
  '# Acme Notes launch memo',
  '',
  'Teams of 5 to 200 people who write a lot and share most of it.',
  '',
].join('\n');
const SUMMARY = ['What people told us', '', '1. Search is slow.', '2. Notes do not sync.'].join(
  '\n',
);

const TURN_3 = testTurn({
  runId: 'run-3',
  finishedAtMs: Date.now() - 120_000,
  folderPath: NOTES_PATH,
  changes: [{ relativePath: 'launch-memo.md' }, { relativePath: 'faq.md' }],
});
const TURN_2 = testTurn({
  runId: 'run-2',
  finishedAtMs: Date.now() - 840_000,
  folderPath: NOTES_PATH,
  changes: [{ relativePath: 'interviews/summary.md', change: 'added' }],
});

const TURN_1 = testTurn({
  runId: 'run-1',
  finishedAtMs: Date.now() - 1_800_000,
  folderPath: NOTES_PATH,
  changes: [{ relativePath: 'launch-memo.md' }],
});

type RestoreArgs = Readonly<{
  args: Readonly<{
    runId: string;
    restoreRunId: string;
    isForced: boolean;
    relativePaths?: ReadonlyArray<string>;
  }>;
}>;

type ReadArgs = Readonly<{
  args: Readonly<{ runId: string; relativePath: string; side: 'before' | 'after' }>;
}>;

type World = {
  turns: Array<FolderTurnManifest>;
  restores: Array<RestoreArgs['args']>;
  changedSince: ReadonlyArray<string>;
  failNext: string | null;
};

const world: World = { turns: [], restores: [], changedSince: [], failNext: null };

const TEXTS: Readonly<Record<string, string>> = {
  'run-1 launch-memo.md before': MEMO_BEFORE,
  'run-1 launch-memo.md after': MEMO_AFTER,
  'run-3 launch-memo.md before': MEMO_BEFORE,
  'run-3 launch-memo.md after': MEMO_AFTER,
  'run-3 faq.md before': 'Pricing is per team.\n',
  'run-3 faq.md after': 'Pricing is per seat.\n',
  'run-2 interviews/summary.md after': SUMMARY,
};

const read = ({ args }: ReadArgs): FolderReadResult => {
  const text = TEXTS[`${args.runId} ${args.relativePath} ${args.side}`];
  return text === undefined
    ? { kind: 'missing', text: null, sizeBytes: null }
    : { kind: 'text', text, sizeBytes: text.length };
};

const restore = ({ args }: RestoreArgs): FolderRestoreResult => {
  world.restores.push(args);
  if (world.failNext !== null) {
    const message = world.failNext;
    world.failNext = null;
    throw new Error(message);
  }
  const target = world.turns.find((turn) => turn.runId === args.runId);
  const paths = args.relativePaths ?? target?.changes.map((change) => change.relativePath) ?? [];
  const blocked = world.changedSince.filter((path) => paths.includes(path));
  if (blocked.length > 0 && !args.isForced) {
    return { status: 'changedSince', changedSince: blocked, turn: null, kept: [] };
  }
  world.changedSince = [];
  const manifest = testTurn({
    runId: args.restoreRunId,
    kind: 'restore',
    restoresRunId: args.runId,
    finishedAtMs: Date.now(),
    folderPath: NOTES_PATH,
    changes: paths.map((relativePath) => ({ relativePath })),
  });
  world.turns = [manifest, ...world.turns];
  return { status: 'restored', changedSince: blocked, turn: manifest, kept: [] };
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  world.turns = [TURN_3, TURN_2];
  world.restores = [];
  world.changedSince = [];
  world.failNext = null;
  stubStoryInvoke({
    file_versions_folder_list_turns: () => world.turns,
    file_versions_folder_read: read,
    file_versions_folder_restore: restore,
    file_versions_folder_size: {
      folderPath: NOTES_PATH,
      isReady: true,
      fileCount: 86,
      keptBytes: 18 * 1024 * 1024,
      versionBytes: 18 * 1024 * 1024,
      versionCount: 12,
      capBytes: 1024 * 1024 * 1024,
    },
  });
  useAppStore.setState({
    workspaces: [workspace],
    currentWorkspaceId: workspace.id,
    projects: [notes],
    sessions: [session],
    sessionProjectMounts: { [sessionId]: [] },
    folderPurpose: { [notes.id]: 'documents' },
  });
});

afterEach(cleanup);

type RowParams = Readonly<{ name: string }>;

const row = ({ name }: RowParams) => screen.getByRole('button', { name });

type DetailParams = Readonly<{ name: string }>;

const detail = async ({ name }: DetailParams) =>
  within(await screen.findByRole('region', { name }));

describe('ChangesPane', () => {
  it('lists each turn with its files and line counts, and shows the change of the picked file', async () => {
    render(<ChangesPane sessionId={sessionId} />);

    expect(await screen.findByText('3 files over 2 turns', { exact: false })).toBeDefined();
    expect(screen.getByRole('region', { name: 'Turn 2' })).toBeDefined();
    await waitFor(() =>
      expect(row({ name: 'launch-memo.md, turn 2' }).textContent).toContain('+1'),
    );
    expect(row({ name: 'launch-memo.md, turn 2' }).textContent).toContain('-1');
    expect(row({ name: 'interviews/summary.md, turn 1' }).textContent).toContain('new');
    const memo = await screen.findByRole('region', { name: 'launch-memo.md' });
    await waitFor(() => expect(memo.textContent).toContain('Teams of 5 to 200 people'));
    const added = memo.querySelector('[data-line-kind="add"]');
    expect(added?.querySelector('[class*="bg-success"]')?.textContent).toContain('5 to 200 people');
    expect(screen.getByText('Saved versions use 18 MB of 1.0 GB')).toBeDefined();
  });

  it('names the other agent that wrote the file since, in the question that asks', async () => {
    const auto = brandId<AgentId>({ value: 'agent-auto' });
    const scout = brandId<AgentId>({ value: 'agent-scout' });
    const opened = (runId: string) =>
      ({
        kind: 'user_text',
        runId: brandId<ProviderRunId>({ value: runId }),
        text: 'go',
        at: brandId<IsoDateTime>({ value: '2026-10-01T10:00:00.000Z' }),
      }) as const;
    world.turns = [TURN_3, TURN_1];
    world.changedSince = ['launch-memo.md'];
    useAppStore.setState({
      sessionPhaseRuns: {
        [sessionId]: [
          anAgent({ id: auto, sessionId, name: 'Auto' }),
          anAgent({ id: scout, sessionId, name: 'Scout' }),
        ],
      },
      transcripts: { [auto]: [opened('run-1')], [scout]: [opened('run-3')] },
    });
    render(<ChangesPane sessionId={sessionId} />);

    fireEvent.click(await screen.findByRole('button', { name: 'launch-memo.md, turn 1' }));
    fireEvent.click(
      await (
        await detail({ name: 'launch-memo.md' })
      ).findByRole('button', { name: /Restore to before turn 1/ }),
    );

    await screen.findByText('launch-memo.md changed after this turn.');
    screen.getByText(/Scout wrote there after turn 1/);
  });

  it('asks before restoring over newer text, restores anyway, then undoes the restore', async () => {
    world.changedSince = ['launch-memo.md'];
    render(<ChangesPane sessionId={sessionId} />);
    const memo = await (
      await detail({ name: 'launch-memo.md' })
    ).findByRole('button', {
      name: /Restore to before turn 2/,
    });

    fireEvent.click(memo);
    expect(await screen.findByText('launch-memo.md changed after this turn.')).toBeDefined();
    expect(world.turns.some((turn) => turn.kind === 'restore')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Restore anyway' }));
    expect(await screen.findByText('Restored launch-memo.md to before turn 2.')).toBeDefined();
    await waitFor(() =>
      expect(row({ name: 'launch-memo.md, turn 2' }).textContent).toContain('Restored'),
    );

    fireEvent.click(
      (await detail({ name: 'launch-memo.md' })).getByRole('button', { name: 'Undo restore' }),
    );
    await waitFor(() =>
      expect(row({ name: 'launch-memo.md, turn 2' }).textContent).toContain('+1'),
    );
    const undo = world.restores.at(-1);
    expect(undo?.runId).toBe(world.turns[1]?.runId);
    expect(undo?.relativePaths).toEqual(['launch-memo.md']);
  });

  it('removes a file the agent created after saving it, and names the action', async () => {
    render(<ChangesPane sessionId={sessionId} />);
    fireEvent.click(await screen.findByRole('button', { name: 'interviews/summary.md, turn 1' }));

    fireEvent.click(
      await (
        await detail({ name: 'interviews/summary.md' })
      ).findByRole('button', { name: /Remove this new file/ }),
    );

    expect(await screen.findByText('Removed interviews/summary.md.')).toBeDefined();
    await waitFor(() =>
      expect(row({ name: 'interviews/summary.md, turn 1' }).textContent).toContain('Removed'),
    );
  });

  it('keeps the file as it was and offers Retry when a restore fails', async () => {
    world.failNext = 'a turn is writing in this folder';
    render(<ChangesPane sessionId={sessionId} />);

    fireEvent.click(
      await (
        await detail({ name: 'launch-memo.md' })
      ).findByRole('button', { name: /Restore to before turn 2/ }),
    );

    expect(await screen.findByText("Couldn't restore launch-memo.md")).toBeDefined();
    expect(
      screen.getByText('A turn is writing in this folder. The file is as it was.'),
    ).toBeDefined();
    expect(row({ name: 'launch-memo.md, turn 2' }).textContent).not.toContain('Restored');

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Restored launch-memo.md to before turn 2.')).toBeDefined();
  });

  it('reads the turns again when the window gets focus, so another window shows', async () => {
    render(<ChangesPane sessionId={sessionId} />);
    expect(await screen.findByRole('button', { name: 'faq.md, turn 2' })).toBeDefined();

    world.turns = [
      testTurn({
        runId: 'run-4',
        finishedAtMs: Date.now(),
        folderPath: NOTES_PATH,
        changes: [{ relativePath: 'pricing.md' }],
      }),
      ...world.turns,
    ];
    fireEvent.focus(window);

    expect(await screen.findByRole('button', { name: 'pricing.md, turn 3' })).toBeDefined();
  });

  it('restores a whole turn and undoes it from the band', async () => {
    render(<ChangesPane sessionId={sessionId} />);

    fireEvent.click(await screen.findByRole('button', { name: /Restore turn 2/ }));

    expect(await screen.findByText('Restored turn 2.')).toBeDefined();
    await waitFor(() => expect(row({ name: 'faq.md, turn 2' }).textContent).toContain('Restored'));
    fireEvent.click(screen.getByRole('button', { name: 'Undo restore of turn 2' }));
    await waitFor(() => expect(row({ name: 'faq.md, turn 2' }).textContent).toContain('+1'));
  });
});
