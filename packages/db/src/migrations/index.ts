import { m001Initial } from './m001-initial';

export interface Migration {
  readonly version: number;
  readonly sql: string;
}

export const migrations: ReadonlyArray<Migration> = [{ version: 1, sql: m001Initial }];
