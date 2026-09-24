import { describe, expect, it } from 'vitest';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrate } from './runner';

describe('m173 spend reservations and writer leases', () => {
  it('adds reservation settlement and durable writer resources', async () => {
    const database = makeTestDatabase();
    await migrate(database);

    const ticketColumns = await database.select<{ readonly name: string }>(
      'PRAGMA table_info(invocation_tickets)',
    );
    const writerTables = await database.select<{ readonly name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'writer_lease%'",
    );

    expect(ticketColumns.some((column) => column.name === 'estimated_spend_usd')).toBe(true);
    expect(ticketColumns.some((column) => column.name === 'measurement_status')).toBe(true);
    expect(writerTables.map((table) => table.name).sort()).toEqual([
      'writer_lease_resources',
      'writer_leases',
    ]);
  });
});
