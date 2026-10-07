// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { clearMocks } from '@tauri-apps/api/mocks';
import {
  deleteSetting,
  getSetting,
  insertSettingIfAbsent,
  listLiveSessionIds,
  replaceSettingIfUnchanged,
  setSetting,
} from '@goodboy/db';
import type { WorkspaceId } from '@goodboy/types';
import { tauriDatabase } from '../../../../shared/lib/db';
import { installSceneDatabase } from './sceneDatabase';

afterEach(() => {
  clearMocks();
});

describe('the scene database', () => {
  it('starts from the seeded settings and reads them back', async () => {
    installSceneDatabase({ settings: { 'sessions.pinned.w1': '[]' } });

    expect(await getSetting(tauriDatabase, 'sessions.pinned.w1')).toBe('[]');
    expect(await getSetting(tauriDatabase, 'sessions.pinned.w2')).toBeNull();
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

  it('answers an unknown select with no rows and an unknown write as one row changed', async () => {
    installSceneDatabase();

    expect(await tauriDatabase.select('SELECT * FROM somewhere', [])).toEqual([]);
    expect(await tauriDatabase.execute('UPDATE somewhere SET x = ?', [1])).toEqual({
      rowsAffected: 1,
    });
  });
});
