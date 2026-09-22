import { describe, expect, it } from 'vitest';
import { makeTestDatabase } from '../test-helpers/test-db';
import { migrate } from './runner';

describe('m168 invocation admission attribution', () => {
  it('creates durable tickets and marks historical telemetry unattributed', async () => {
    const database = makeTestDatabase();
    await migrate(database);

    const ticketColumns = await database.select<{ readonly name: string }>(
      'PRAGMA table_info(invocation_tickets)',
    );
    const telemetryColumns = await database.select<{ readonly name: string }>(
      'PRAGMA table_info(telemetry_records)',
    );

    expect(ticketColumns.some((column) => column.name === 'process_id')).toBe(true);
    expect(ticketColumns.some((column) => column.name === 'provider_identity')).toBe(true);
    expect(telemetryColumns.some((column) => column.name === 'attribution_status')).toBe(true);
  });
});
