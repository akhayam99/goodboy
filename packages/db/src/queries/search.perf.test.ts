import { describe, expect, it } from 'vitest';
import type { SearchQuery, SessionId } from '@goodboy/types';
import type { Database } from '../client';
import { makeMigratedTestDatabase } from '../test-helpers/test-db';
import { SEARCH_WORLD, seedSearchWorld } from '../test-helpers/search-fixtures';
import { rebuildSearchIndex, runSearchBackfillStep } from '../maintenance/searchBackfill';
import { searchIndex } from './search';

const MESSAGES = 100_000;
const CHUNK = 1_000;
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

type RandomParams = {
  readonly seed: number;
};

const random = ({ seed }: RandomParams): number => {
  const value = Math.sin(seed * 12.9898) * 43_758.5453;
  return value - Math.floor(value);
};

const VOCABULARY = Array.from({ length: 6_000 }, (_, index) =>
  Array.from(
    { length: 3 + Math.floor(random({ seed: index + 1 }) * 8) },
    (_, letter) => LETTERS[Math.floor(random({ seed: index * 31 + letter + 7 }) * 26)] ?? 'a',
  ).join(''),
);

type SentenceParams = {
  readonly seed: number;
};

const sentence = ({ seed }: SentenceParams): string =>
  Array.from({ length: 60 }, (_, index) => {
    const pick = random({ seed: seed * 61 + index + 1 }) ** 3;
    return VOCABULARY[Math.floor(pick * VOCABULARY.length)] ?? 'ledger';
  })
    .join(' ')
    .concat(seed % 997 === 0 ? ' kestrel' : '', seed % 5 === 0 ? ' payout ledger' : '');

type SeedParams = {
  readonly db: Database;
};

const seedMessages = async ({ db }: SeedParams): Promise<void> => {
  const w = SEARCH_WORLD;
  for (let start = 0; start < MESSAGES; start += CHUNK) {
    const rows = Array.from({ length: CHUNK }, (_, offset) => {
      const n = start + offset;
      const session = n % 2 === 0 ? w.sessionId : w.otherSessionId;
      const agent = n % 2 === 0 ? w.agentId : w.otherAgentId;
      const role = n % 3 === 0 ? 'assistant' : 'user';
      return `('p${String(n).padStart(6, '0')}', '${session}', '${agent}', '${role}', '${sentence({ seed: n })}', ${w.now - n * 60_000})`;
    });
    await db.exec(
      `INSERT INTO messages (id, session_id, agent_id, role, content, created_at) VALUES ${rows.join(',')}`,
    );
  }
};

const QUERY: SearchQuery = {
  text: '',
  kinds: [],
  workspaceId: null,
  sessionId: null,
  projectIds: [],
  providers: [],
  statuses: [],
  after: null,
  before: null,
  archived: 'exclude',
  limit: 50,
};

type TimeParams = {
  readonly db: Database;
  readonly query: Partial<SearchQuery>;
};

const timed = async ({ db, query }: TimeParams): Promise<{ ms: number; count: number }> => {
  const started = performance.now();
  const hits = await searchIndex({ db, query: { ...QUERY, ...query }, now: SEARCH_WORLD.now });
  return { ms: performance.now() - started, count: hits.length };
};

describe('search on 100k messages', () => {
  it('indexes on write, answers under budget and backfills in bounded steps', async () => {
    const db = await makeMigratedTestDatabase();
    await seedSearchWorld({ db });
    const writeStarted = performance.now();
    await seedMessages({ db });
    const writeMs = performance.now() - writeStarted;
    expect(writeMs / MESSAGES).toBeLessThan(1);

    const rare = await timed({ db, query: { text: 'kestrel' } });
    expect(rare.count).toBe(50);
    expect(rare.ms).toBeLessThan(250);

    const common = await timed({ db, query: { text: 'payout ledger' } });
    expect(common.count).toBe(50);
    expect(common.ms).toBeLessThan(500);

    const scoped = await timed({
      db,
      query: { text: 'pay', sessionId: SEARCH_WORLD.sessionId as SessionId, kinds: ['message'] },
    });
    expect(scoped.count).toBe(50);
    expect(scoped.ms).toBeLessThan(500);

    const recent = await timed({ db, query: { kinds: ['message'] } });
    expect(recent.count).toBe(50);
    expect(recent.ms).toBeLessThan(500);

    await rebuildSearchIndex({ db });
    let slowest = 0;
    for (;;) {
      const started = performance.now();
      const step = await runSearchBackfillStep({ db, now: SEARCH_WORLD.now });
      slowest = Math.max(slowest, performance.now() - started);
      if (step.isDone) {
        break;
      }
    }
    expect(slowest).toBeLessThan(200);
    expect((await timed({ db, query: { text: 'kestrel' } })).count).toBe(50);
  }, 240_000);
});
