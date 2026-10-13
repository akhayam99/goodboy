import { describe, expect, it } from 'vitest';
import type { IsoDateTime, SessionId } from '@goodboy/types';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { getSessionContextSeenAt, setSessionContextSeenAt } from '../queries/session-context-seen';
import { migrations } from './index';
import { migrate } from './runner';

const SESSION = 'session' as SessionId;

type AtParams = { readonly value: string };

const at = ({ value }: AtParams): IsoDateTime => value as IsoDateTime;

const seedBefore = async (): Promise<Database> => {
  const db = await makeMigratedTestDatabase({ throughVersion: 195 });
  await db.execute(
    "INSERT INTO workspaces (id, name, slug, created_at, updated_at) VALUES ('workspace', 'Harborline', 'harborline', 1, 1)",
  );
  await db.execute(
    "INSERT INTO sessions (id, workspace_id, goal, state_kind, created_at, updated_at) VALUES ('session', 'workspace', 'Checkout', 'idle', 1, 1)",
  );
  return db;
};

describe('m196 session context seen', () => {
  it('leaves sessions made before it as never seen', async () => {
    const db = await seedBefore();

    await migrate(db, migrations);

    expect(await getSessionContextSeenAt(db, SESSION)).toBeNull();
  });

  it('keeps when the decisions were last looked at', async () => {
    const db = await seedBefore();
    await migrate(db, migrations);

    await setSessionContextSeenAt(db, SESSION, at({ value: '2026-09-26T10:00:00.000Z' }));

    expect(await getSessionContextSeenAt(db, SESSION)).toBe('2026-09-26T10:00:00.000Z');
  });

  it('never moves the persisted time backward when writes finish out of order', async () => {
    const db = await seedBefore();
    await migrate(db, migrations);

    await setSessionContextSeenAt(db, SESSION, at({ value: '2026-09-26T10:05:00.000Z' }));
    await setSessionContextSeenAt(db, SESSION, at({ value: '2026-09-26T10:00:00.000Z' }));

    expect(await getSessionContextSeenAt(db, SESSION)).toBe('2026-09-26T10:05:00.000Z');

    await setSessionContextSeenAt(db, SESSION, at({ value: '2026-09-26T10:10:00.000Z' }));

    expect(await getSessionContextSeenAt(db, SESSION)).toBe('2026-09-26T10:10:00.000Z');
  });
});
