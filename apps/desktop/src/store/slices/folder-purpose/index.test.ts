import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertProject, insertWorkspace, setSetting } from '@goodboy/db';
import {
  brandId,
  type FolderFileKind,
  type FolderSignals,
  type ProjectId,
  type WorkspaceId,
} from '@goodboy/types';
import {
  buildStoryProject,
  buildStoryWorkspace,
  importStore,
  injectDbFault,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  STORE_IMPORT_TIMEOUT_MS,
  storySqlite,
  stubStoryInvoke,
  type StoryStore,
} from '../../storyHarness';
import { folderPurposeKey } from './folderPurposeKey';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).sqliteDbLibModuleMock(),
);
vi.mock('../../../features/chat/turn', async () =>
  (await import('../../storyHarness')).turnModuleMock(),
);
vi.mock('../../../features/permissions/permissions', async () =>
  (await import('../../storyHarness')).permissionsModuleMock(),
);
vi.mock('../../../features/providers/providers', async () =>
  (await import('../../storyHarness')).providersModuleMock(),
);
vi.mock('../../../features/providers/routing', async () =>
  (await import('../../storyHarness')).routingModuleMock(),
);
vi.mock('../../../features/budget/budget', async () =>
  (await import('../../storyHarness')).budgetModuleMock(),
);
vi.mock('../../../features/skills/skills', async () =>
  (await import('../../storyHarness')).skillsModuleMock(),
);
vi.mock('../../../features/workflows/workflows', async () =>
  (await import('../../storyHarness')).workflowsModuleMock(),
);
vi.mock('../../../features/worktree/worktree', async () =>
  (await import('../../storyHarness')).worktreeModuleMock(),
);

const ACME = brandId<WorkspaceId>({ value: 'workspace-acme' });
const NOTES = brandId<ProjectId>({ value: 'project-acme-notes' });
const NOTES_PATH = '/Users/me/Documents/acme-notes';
const WEB_PATH = '/Users/me/Code/acme-web';

const NO_FILES: Readonly<Record<FolderFileKind, number>> = {
  markdown: 0,
  text: 0,
  pdf: 0,
  word: 0,
  pages: 0,
  keynote: 0,
  numbers: 0,
  excel: 0,
  powerpoint: 0,
  image: 0,
  video: 0,
  audio: 0,
  source: 0,
  other: 0,
};

type SignalsParams = {
  readonly path: string;
  readonly counts: Partial<Record<FolderFileKind, number>>;
  readonly hasManifest?: boolean;
};

const signalsOf = ({ path, counts, hasManifest = false }: SignalsParams): FolderSignals => ({
  path,
  markers: hasManifest ? ['package.json'] : [],
  counts: { ...NO_FILES, ...counts },
  totalFiles: Object.values(counts).reduce((total, count) => total + count, 0),
  totalBytes: 42_000_000,
  entriesRead: 98,
  isTruncated: false,
});

type Deferred<Value> = {
  readonly promise: Promise<Value>;
  readonly resolve: (value: Value) => void;
  readonly reject: (error: Error) => void;
};

const deferred = <Value>(): Deferred<Value> => {
  let resolve: (value: Value) => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise = new Promise<Value>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
};

let useAppStore: StoryStore;

const storedRow = async (): Promise<string | null> =>
  (
    await rowsOf<{ readonly value: string }>({
      sql: 'SELECT value FROM settings WHERE key = ?',
      params: [folderPurposeKey({ projectId: NOTES })],
    })
  )[0]?.value ?? null;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  const db = await openStorySqlite();
  const workspace = buildStoryWorkspace({ id: ACME, name: 'Acme notes', slug: 'acme-notes' });
  const project = buildStoryProject({
    id: NOTES,
    workspaceId: ACME,
    name: 'acme-notes',
    rootPath: NOTES_PATH,
    kind: 'folder',
  });
  await insertWorkspace({ db, workspace });
  await insertProject({ db, project });
  useAppStore.setState({ workspaces: [workspace], projects: [project] });
});

describe('folder purpose', () => {
  it('stores the face as one settings row and reads it back on hydrate', async () => {
    await useAppStore.getState().setFolderPurpose({ projectId: NOTES, purpose: 'documents' });

    expect(await storedRow()).toBe('documents');
    expect(useAppStore.getState().folderPurpose[NOTES]).toBe('documents');

    useAppStore.setState({ folderPurpose: {} });
    await useAppStore.getState().hydrateFolderPurposes();

    expect(useAppStore.getState().folderPurpose).toEqual({ [NOTES]: 'documents' });
  });

  it('skips a row it cannot read', async () => {
    await setSetting(storySqlite(), folderPurposeKey({ projectId: NOTES }), 'spreadsheet');
    await setSetting(storySqlite(), 'folder.purpose.', 'code');

    await useAppStore.getState().hydrateFolderPurposes();

    expect(useAppStore.getState().folderPurpose).toEqual({});
  });

  it('keeps the old face when the write fails, and Retry saves the new one', async () => {
    await useAppStore.getState().setFolderPurpose({ projectId: NOTES, purpose: 'documents' });
    injectDbFault({ match: /UPDATE settings/, message: 'disk I/O error' });

    await expect(
      useAppStore.getState().setFolderPurpose({ projectId: NOTES, purpose: 'code' }),
    ).rejects.toThrow('disk I/O error');

    expect(useAppStore.getState().folderPurpose[NOTES]).toBe('documents');
    expect(await storedRow()).toBe('documents');

    await useAppStore.getState().setFolderPurpose({ projectId: NOTES, purpose: 'code' });

    expect(useAppStore.getState().folderPurpose[NOTES]).toBe('code');
    expect(await storedRow()).toBe('code');
  });

  it('reads again when another window changed the row between read and write', async () => {
    const db = storySqlite();
    const select = db.select.bind(db);
    let reads = 0;
    vi.spyOn(db, 'select').mockImplementation(async (sql, params) => {
      const rows = await select(sql, params);
      if (sql.includes('FROM settings WHERE key') && reads === 0) {
        reads += 1;
        await setSetting(db, folderPurposeKey({ projectId: NOTES }), 'code');
      }
      return rows;
    });

    const purpose = await useAppStore
      .getState()
      .setFolderPurpose({ projectId: NOTES, purpose: 'documents' });

    expect(purpose).toBe('documents');
    expect(await storedRow()).toBe('documents');
    expect(useAppStore.getState().folderPurpose[NOTES]).toBe('documents');
  });

  it('gives up after two lost races and keeps the old face', async () => {
    await useAppStore.getState().setFolderPurpose({ projectId: NOTES, purpose: 'code' });
    const db = storySqlite();
    const select = db.select.bind(db);
    const key = folderPurposeKey({ projectId: NOTES });
    const otherWindow: Array<() => Promise<unknown>> = [
      () => db.execute('DELETE FROM settings WHERE key = ?', [key]),
      () => setSetting(db, key, 'code'),
    ];
    vi.spyOn(db, 'select').mockImplementation(async (sql, params) => {
      const rows = await select(sql, params);
      const change = sql.includes('FROM settings WHERE key') ? otherWindow.shift() : undefined;
      if (change !== undefined) {
        await change();
      }
      return rows;
    });

    await expect(
      useAppStore.getState().setFolderPurpose({ projectId: NOTES, purpose: 'documents' }),
    ).rejects.toThrow('kept changing');

    expect(useAppStore.getState().folderPurpose[NOTES]).toBe('code');
  });

  it('refuses a folder that is no longer in a workspace and writes nothing', async () => {
    useAppStore.setState({ projects: [] });

    await expect(
      useAppStore.getState().setFolderPurpose({ projectId: NOTES, purpose: 'code' }),
    ).rejects.toThrow('no longer in a workspace');

    expect(await storedRow()).toBeNull();
  });

  it('loads the face another window saved, and drops one it removed', async () => {
    await setSetting(storySqlite(), folderPurposeKey({ projectId: NOTES }), 'code');

    expect(await useAppStore.getState().loadFolderPurpose({ projectId: NOTES })).toBe('code');
    expect(useAppStore.getState().folderPurpose[NOTES]).toBe('code');

    await storySqlite().execute('DELETE FROM settings WHERE key = ?', [
      folderPurposeKey({ projectId: NOTES }),
    ]);

    expect(await useAppStore.getState().loadFolderPurpose({ projectId: NOTES })).toBeNull();
    expect(useAppStore.getState().folderPurpose).toEqual({});
  });

  it('writes the face with the folder at Create, and nothing when the insert fails', async () => {
    const WEB_WORKSPACE = brandId<WorkspaceId>({ value: 'workspace-acme-web' });
    const params = {
      workspaceId: WEB_WORKSPACE,
      name: 'Acme web',
      folders: [{ kind: 'plain' as const, rootPath: WEB_PATH, purpose: 'code' as const }],
      moves: [],
    };
    stubStoryInvoke({
      file_versions_folder_prepare: ({
        args,
      }: {
        readonly args: { readonly folderPath: string };
      }) => ({
        folderPath: args.folderPath,
        isReady: true,
        isTurnOpen: false,
        fileCount: 214,
        keptBytes: 9_000_000,
        skipped: [],
        method: 'clone',
      }),
    });
    injectDbFault({ match: /INSERT INTO projects/, message: 'disk I/O error' });

    await expect(useAppStore.getState().createWorkspaceWithFolders(params)).rejects.toThrow();

    expect(
      await rowsOf({ sql: "SELECT key FROM settings WHERE key LIKE 'folder.purpose.%'" }),
    ).toEqual([]);
    expect(useAppStore.getState().folderPurpose).toEqual({});

    const created = await useAppStore.getState().createWorkspaceWithFolders(params);
    const web = created.projects[0];

    expect(web?.kind).toBe('folder');
    const webId = web?.id ?? NOTES;
    expect(useAppStore.getState().folderPurpose[webId]).toBe('code');
    expect(
      await rowsOf({
        sql: 'SELECT value FROM settings WHERE key = ?',
        params: [folderPurposeKey({ projectId: webId })],
      }),
    ).toEqual([{ value: 'code' }]);
  });
});

describe('folder signals', () => {
  it('reads the folder and preselects from what it saw', async () => {
    stubStoryInvoke({
      read_folder_signals: ({ path }: { readonly path: string }) =>
        signalsOf({ path, counts: { markdown: 86, pdf: 12 } }),
    });

    const read = await useAppStore.getState().scanFolderSignals({ path: NOTES_PATH });

    expect(read?.preselected).toBe('documents');
    expect(read?.signals.counts.markdown).toBe(86);
    expect(useAppStore.getState().folderSignals[NOTES_PATH]).toEqual(read);
  });

  it('preselects nothing for an empty folder', async () => {
    stubStoryInvoke({
      read_folder_signals: ({ path }: { readonly path: string }) => signalsOf({ path, counts: {} }),
    });

    const read = await useAppStore.getState().scanFolderSignals({ path: WEB_PATH });

    expect(read?.preselected).toBeNull();
  });

  it('drops an older scan of the same folder that answers late', async () => {
    const first = deferred<FolderSignals>();
    const second = deferred<FolderSignals>();
    const answers = [first, second];
    stubStoryInvoke({
      read_folder_signals: () => answers.shift()?.promise,
    });

    const older = useAppStore.getState().scanFolderSignals({ path: WEB_PATH });
    const newer = useAppStore.getState().scanFolderSignals({ path: WEB_PATH });
    second.resolve(signalsOf({ path: WEB_PATH, counts: { source: 214 }, hasManifest: true }));
    expect((await newer)?.preselected).toBe('code');
    first.resolve(signalsOf({ path: WEB_PATH, counts: { markdown: 3 } }));

    expect(await older).toBeNull();
    expect(useAppStore.getState().folderSignals[WEB_PATH]?.preselected).toBe('code');
  });

  it('keeps the last reading when a new scan fails, and a rescan replaces it', async () => {
    const answers: Array<() => FolderSignals> = [
      () => signalsOf({ path: NOTES_PATH, counts: { markdown: 4 } }),
      () => {
        throw new Error('permission denied: /Users/me/Documents/acme-notes');
      },
      () => signalsOf({ path: NOTES_PATH, counts: { source: 9 } }),
    ];
    stubStoryInvoke({
      read_folder_signals: () => answers.shift()?.(),
    });

    await useAppStore.getState().scanFolderSignals({ path: NOTES_PATH });
    await expect(useAppStore.getState().scanFolderSignals({ path: NOTES_PATH })).rejects.toThrow(
      'permission denied',
    );

    expect(useAppStore.getState().folderSignals[NOTES_PATH]?.preselected).toBe('documents');

    await useAppStore.getState().scanFolderSignals({ path: NOTES_PATH });

    expect(useAppStore.getState().folderSignals[NOTES_PATH]?.preselected).toBe('code');
  });
});
