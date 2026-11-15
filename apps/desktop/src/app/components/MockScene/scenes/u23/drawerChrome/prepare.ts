import type { MountId } from '@goodboy/types';
import { discoveredScriptId } from '../../../../../../features/scripts/scripts';
import { useAppStore } from '../../../../../../store';
import { SESSION_ID } from '../../activityRunSeed';

const LONG_TOKEN =
  'ledger-core/src/settlement/backfill/checkpoints/2026-10-05T10-00-00Z/shard-0007/part-000041.parquet.zst';

const SCRIPT_GROUP = {
  source: 'package-json',
  packageName: 'payments-api',
  relDir: '',
  manager: 'pnpm',
  scripts: [{ name: 'test', command: 'vitest run --reporter verbose', body: '' }],
} as const;

export const prepareToast = (): void => {
  useAppStore.getState().openDrawer({ kind: 'scripts', sessionId: SESSION_ID, payload: null });
};

export type HeadersSeed = {
  readonly scriptKey: string;
  readonly worktreePath: string;
  readonly mountId: MountId | null;
};

export const prepareHeaders = (): HeadersSeed => {
  const mount = useAppStore.getState().sessionProjectMounts[SESSION_ID]?.[0];
  const worktreePath = mount?.worktreePath ?? '~/code/harborline/payments-api-backfill';
  const scriptKey = discoveredScriptId({
    worktreePath,
    source: SCRIPT_GROUP.source,
    relDir: SCRIPT_GROUP.relDir,
    name: 'test',
  });
  useAppStore.setState({
    discoveredScripts: { [SESSION_ID]: { [worktreePath]: [SCRIPT_GROUP] } },
    discoveredScriptScans: {
      [SESSION_ID]: { [worktreePath]: { status: 'ready', error: null } },
    },
    scriptRuns: {
      [SESSION_ID]: {
        [scriptKey]: {
          status: 'error',
          result: {
            stdout: ['> payments-api@2.14.0 test', '> vitest run', ''].join('\n'),
            stderr: `ENOENT: no such file or directory, open '${LONG_TOKEN}'`,
            exitCode: 1,
          },
          runId: 'mock-headers-run',
          startedAt: Date.now() - 42_000,
          completedAt: Date.now() - 30_000,
          name: 'test',
        },
      },
    },
    loadDiscoveredScripts: async () => undefined,
    loadScriptPins: async () => undefined,
  });
  return { scriptKey, worktreePath, mountId: mount?.mountId ?? null };
};
