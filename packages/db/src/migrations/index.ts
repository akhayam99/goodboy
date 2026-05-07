import { m001Initial } from './m001-initial';
import { m002TelemetryKind } from './m002-telemetry-kind';
import { m003SessionProvider } from './m003-session-provider';
import { m004TurnOverrides } from './m004-turn-overrides';
import { m005BudgetTables } from './m005-budget-tables';
import { m006Skills } from './m006-skills';

export interface Migration {
  readonly version: number;
  readonly sql: string;
}

export const migrations: ReadonlyArray<Migration> = [
  { version: 1, sql: m001Initial },
  { version: 2, sql: m002TelemetryKind },
  { version: 3, sql: m003SessionProvider },
  { version: 4, sql: m004TurnOverrides },
  { version: 5, sql: m005BudgetTables },
  { version: 6, sql: m006Skills },
];
