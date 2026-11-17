import { brandId, type SessionId } from '@goodboy/types';
import { describe, expect, it } from 'vitest';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { AUTO_SEED_NOW, AUTO_SEED_SESSION, seedAutoSession } from '../test-helpers/auto-seeds';
import { getSessionDockGrid, saveSessionDockGrid } from './session-dock-grid';

const TERMINAL = '{"version":1,"columns":[["terminal"]]}';
const BROWSER = '{"version":1,"columns":[["browser"]]}';

const seeded = async () => {
  const db = await makeMigratedTestDatabase();
  await seedAutoSession({ db });
  return db;
};

describe('the dock grid saved on a session', () => {
  it('reads nothing for a session that never saved one', async () => {
    const db = await seeded();

    expect(await getSessionDockGrid({ db, sessionId: AUTO_SEED_SESSION })).toBeNull();
  });

  it('saves a grid and replaces it with a later one', async () => {
    const db = await seeded();

    await saveSessionDockGrid({
      db,
      sessionId: AUTO_SEED_SESSION,
      grid: TERMINAL,
      savedAt: AUTO_SEED_NOW,
    });
    await saveSessionDockGrid({
      db,
      sessionId: AUTO_SEED_SESSION,
      grid: BROWSER,
      savedAt: AUTO_SEED_NOW + 1,
    });

    expect(await getSessionDockGrid({ db, sessionId: AUTO_SEED_SESSION })).toBe(BROWSER);
    expect(await db.select('SELECT COUNT(*) AS n FROM session_dock_grids')).toEqual([{ n: 1 }]);
  });

  it('keeps the last write when a second window answers late with an older grid', async () => {
    const db = await seeded();

    await saveSessionDockGrid({
      db,
      sessionId: AUTO_SEED_SESSION,
      grid: BROWSER,
      savedAt: AUTO_SEED_NOW + 5,
    });
    await saveSessionDockGrid({
      db,
      sessionId: AUTO_SEED_SESSION,
      grid: TERMINAL,
      savedAt: AUTO_SEED_NOW,
    });

    expect(await getSessionDockGrid({ db, sessionId: AUTO_SEED_SESSION })).toBe(BROWSER);
  });

  it('writes nothing for a session another window deleted', async () => {
    const db = await seeded();
    const gone = brandId<SessionId>({ value: 'session-notify-relay' });

    await saveSessionDockGrid({ db, sessionId: gone, grid: TERMINAL, savedAt: AUTO_SEED_NOW });

    expect(await getSessionDockGrid({ db, sessionId: gone })).toBeNull();
  });
});
