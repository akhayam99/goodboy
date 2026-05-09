import { m001Initial } from './m001-initial';
import { m002TelemetryKind } from './m002-telemetry-kind';
import { m003SessionProvider } from './m003-session-provider';
import { m004TurnOverrides } from './m004-turn-overrides';
import { m005BudgetTables } from './m005-budget-tables';
import { m006Skills } from './m006-skills';
import { m007Phases } from './m007-phases';
import { m008Permissions } from './m008-permissions';
import { m009SessionWorktrees } from './m009-session-worktrees';
import { m010PermissionAuditRetry } from './m010-permission-audit-retry';
import { m011ParallelPhases } from './m011-parallel-phases';
import { m012SettingsOverrides } from './m012-settings-overrides';
import { m013BudgetExtraTokens } from './m013-budget-extra-tokens';
import { m014RenameDomain } from './m014-rename-domain';
import { m015AgentsPerChat } from './m015-agents-per-chat';

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
  { version: 7, sql: m007Phases },
  { version: 8, sql: m008Permissions },
  { version: 9, sql: m009SessionWorktrees },
  { version: 10, sql: m010PermissionAuditRetry },
  { version: 11, sql: m011ParallelPhases },
  { version: 12, sql: m012SettingsOverrides },
  { version: 13, sql: m013BudgetExtraTokens },
  { version: 14, sql: m014RenameDomain },
  { version: 15, sql: m015AgentsPerChat },
];
