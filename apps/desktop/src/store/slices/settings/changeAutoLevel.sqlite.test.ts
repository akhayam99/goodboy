// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).sqliteDbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTO_SEED_SESSION, seedAutoSession } from '@goodboy/db/test-helpers/auto-seeds';
import { brandId, type WorkspaceId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySqlite,
  type StoryStore,
} from '../../storyHarness';
import { readAutoLevel } from '../../runtime/auto/level/readAutoLevel';
import { writeAutoLevel } from '../../runtime/auto/level/writeAutoLevel';

const WORKSPACE = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const SESSION = { sessionId: AUTO_SEED_SESSION };
const NEWER_LANDS_FIRST_MS = 40;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  await openStorySqlite();
  await seedAutoSession({ db: storySqlite() });
  await writeAutoLevel({ db: storySqlite(), target: SESSION, level: 'plan' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

type HoldParams = {
  readonly level: string;
  readonly until: string;
};

const holdWriteOf = ({ level, until }: HoldParams) => {
  const db = storySqlite();
  const real = db.execute.bind(db);
  let isHeld = false;
  let release: () => void = () => undefined;
  const opened = new Promise<void>((resolve) => {
    release = resolve;
  });
  vi.spyOn(db, 'execute').mockImplementation(async (sql, args) => {
    const isUpdate = sql.startsWith('UPDATE workspace_values');
    const written = String(args?.[0] ?? '');
    if (isUpdate && !isHeld && written.includes(`"${level}"`)) {
      isHeld = true;
      await Promise.race([
        opened,
        new Promise<void>((resolve) => setTimeout(resolve, NEWER_LANDS_FIRST_MS)),
      ]);
    }
    const result = await real(sql, args);
    if (isUpdate && written.includes(`"${until}"`)) {
      release();
    }
    return result;
  });
};

describe('changeAutoLevel', () => {
  it('keeps the last pick when an older pick would land after a newer one', async () => {
    holdWriteOf({ level: 'step', until: 'run' });
    const { changeAutoLevel } = useAppStore.getState();

    await Promise.all([
      changeAutoLevel({ workspaceId: WORKSPACE, sessionId: AUTO_SEED_SESSION, level: 'step' }),
      changeAutoLevel({ workspaceId: WORKSPACE, sessionId: AUTO_SEED_SESSION, level: 'run' }),
    ]);

    expect(await readAutoLevel({ db: storySqlite(), target: SESSION })).toBe('run');
    const held = useAppStore.getState().workspaceValues[WORKSPACE]?.['auto.level'] ?? '';
    expect(JSON.parse(held).sessions[AUTO_SEED_SESSION]).toBe('run');
  });

  it('lets a pick after a failed one write and report only its own failure', async () => {
    const db = storySqlite();
    vi.spyOn(db, 'execute').mockRejectedValueOnce(new Error('disk unavailable'));
    const { changeAutoLevel } = useAppStore.getState();

    const failed = changeAutoLevel({
      workspaceId: WORKSPACE,
      sessionId: AUTO_SEED_SESSION,
      level: 'step',
    });
    const next = changeAutoLevel({
      workspaceId: WORKSPACE,
      sessionId: AUTO_SEED_SESSION,
      level: 'run',
    });

    await expect(failed).rejects.toThrow('disk unavailable');
    await next;
    expect(await readAutoLevel({ db, target: SESSION })).toBe('run');
  });
});
