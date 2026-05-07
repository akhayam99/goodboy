import { m001Initial } from './m001-initial';
import { m002TelemetryKind } from './m002-telemetry-kind';

export interface Migration {
  readonly version: number;
  readonly sql: string;
}

export const migrations: ReadonlyArray<Migration> = [
  { version: 1, sql: m001Initial },
  { version: 2, sql: m002TelemetryKind },
];
