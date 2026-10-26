// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { clearMocks } from '@tauri-apps/api/mocks';
import {
  countLiveAutoTrees,
  deleteSetting,
  getSetting,
  getWorkspaceValue,
  insertSettingIfAbsent,
  insertWorkspaceValueIfAbsent,
  listLiveSessionIds,
  replaceSettingIfUnchanged,
  replaceWorkspaceValueIfUnchanged,
  setSetting,
  setWorkspaceValue,
} from '@goodboy/db';
import { brandId, type WorkspaceId } from '@goodboy/types';
import { tauriDatabase } from '../../../../shared/lib/db';
import { installSceneDatabase } from './sceneDatabase';

afterEach(() => {
  clearMocks();
});

describe('the scene database', () => {
  it('starts from the seeded settings and reads them back', async () => {
    installSceneDatabase({ settings: { 'editor.binary': 'code' } });

    expect(await getSetting(tauriDatabase, 'editor.binary')).toBe('code');
    expect(await getSetting(tauriDatabase, 'terminal.names')).toBeNull();
  });

  it('starts from the seeded workspace values and keeps workspaces apart', async () => {
    installSceneDatabase({ workspaceValues: { w1: { 'sessions.pinned': '[]' } } });
    const w1 = brandId<WorkspaceId>({ value: 'w1' });
    const w2 = brandId<WorkspaceId>({ value: 'w2' });

    expect(
      await getWorkspaceValue({ db: tauriDatabase, workspaceId: w1, key: 'sessions.pinned' }),
    ).toBe('[]');
    expect(
      await getWorkspaceValue({ db: tauriDatabase, workspaceId: w2, key: 'sessions.pinned' }),
    ).toBeNull();
  });

  it('inserts, replaces and upserts a workspace value with the same guards as the table', async () => {
    installSceneDatabase();
    const workspaceId = brandId<WorkspaceId>({ value: 'w1' });
    const key = 'sessions.pinned';

    expect(
      await insertWorkspaceValueIfAbsent({ db: tauriDatabase, workspaceId, key, value: 'a' }),
    ).toBe(true);
    expect(
      await insertWorkspaceValueIfAbsent({ db: tauriDatabase, workspaceId, key, value: 'b' }),
    ).toBe(false);
    expect(
      await replaceWorkspaceValueIfUnchanged({
        db: tauriDatabase,
        workspaceId,
        key,
        expected: 'x',
        value: 'c',
      }),
    ).toBe(false);
    expect(
      await replaceWorkspaceValueIfUnchanged({
        db: tauriDatabase,
        workspaceId,
        key,
        expected: 'a',
        value: 'c',
      }),
    ).toBe(true);
    await setWorkspaceValue({ db: tauriDatabase, workspaceId, key, value: 'd' });
    expect(await getWorkspaceValue({ db: tauriDatabase, workspaceId, key })).toBe('d');
  });

  it('inserts a missing setting once and refuses a second insert', async () => {
    installSceneDatabase();

    expect(await insertSettingIfAbsent({ db: tauriDatabase, key: 'k', value: 'a' })).toBe(true);
    expect(await insertSettingIfAbsent({ db: tauriDatabase, key: 'k', value: 'b' })).toBe(false);
    expect(await getSetting(tauriDatabase, 'k')).toBe('a');
  });

  it('replaces a setting only while it still holds the value it was read with', async () => {
    installSceneDatabase({ settings: { k: 'a' } });

    expect(
      await replaceSettingIfUnchanged(tauriDatabase, { key: 'k', expected: 'x', value: 'b' }),
    ).toBe(false);
    expect(await getSetting(tauriDatabase, 'k')).toBe('a');
    expect(
      await replaceSettingIfUnchanged(tauriDatabase, { key: 'k', expected: 'a', value: 'b' }),
    ).toBe(true);
    expect(await getSetting(tauriDatabase, 'k')).toBe('b');
  });

  it('upserts and deletes a setting', async () => {
    installSceneDatabase();

    await setSetting(tauriDatabase, 'k', 'a');
    await setSetting(tauriDatabase, 'k', 'b');
    expect(await getSetting(tauriDatabase, 'k')).toBe('b');
    await deleteSetting(tauriDatabase, 'k');
    expect(await getSetting(tauriDatabase, 'k')).toBeNull();
  });

  it('answers the live session ids of a workspace from the scene, and an empty list otherwise', async () => {
    installSceneDatabase({
      liveSessionIds: (workspaceId) => (workspaceId === 'w1' ? ['s1', 's2'] : []),
    });

    expect(
      await listLiveSessionIds({ db: tauriDatabase, workspaceId: 'w1' as WorkspaceId }),
    ).toEqual(['s1', 's2']);
    expect(
      await listLiveSessionIds({ db: tauriDatabase, workspaceId: 'w2' as WorkspaceId }),
    ).toEqual([]);
  });

  it('answers the count of live Auto trees from the scene, none by default', async () => {
    installSceneDatabase({ liveAutoTrees: 2 });
    expect(await countLiveAutoTrees({ db: tauriDatabase })).toBe(2);

    installSceneDatabase();
    expect(await countLiveAutoTrees({ db: tauriDatabase })).toBe(0);
  });

  it('answers an unknown select with no rows and an unknown write as one row changed', async () => {
    installSceneDatabase();

    expect(await tauriDatabase.select('SELECT * FROM somewhere', [])).toEqual([]);
    expect(await tauriDatabase.execute('UPDATE somewhere SET x = ?', [1])).toEqual({
      rowsAffected: 1,
    });
  });
});
