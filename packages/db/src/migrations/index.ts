import { m001Initial } from './m001-initial';
import { m002TelemetryKind } from './m002-telemetry-kind';
import { m003SessionProvider } from './m003-session-provider';

export interface Migration {
  readonly version: number;
  readonly sql: string;
}

export const migrations: ReadonlyArray<Migration> = [
  { version: 1, sql: m001Initial },
  { version: 2, sql: m002TelemetryKind },
  { version: 3, sql: m003SessionProvider },
];
