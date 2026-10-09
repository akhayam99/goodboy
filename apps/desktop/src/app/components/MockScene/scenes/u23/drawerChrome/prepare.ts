import type { ChatId, MountId } from '@goodboy/types';
import { discoveredScriptId } from '../../../../../../features/scripts/scripts';
import { useAppStore } from '../../../../../../store';
import { SESSION_ID } from '../../activityRunSeed';
import { seedSessionAsk } from '../../sessionAskSeed';

const DRAFT = 'Which of these should I fix first, and what breaks if I skip it?';

const LONG_TOKEN =
  'ledger-core/src/settlement/backfill/checkpoints/2026-10-05T10-00-00Z/shard-0007/part-000041.parquet.zst';

const SCRIPT_GROUP = {
  source: 'package-json',
  packageName: 'payments-api',
  relDir: '',
  manager: 'pnpm',
  scripts: [{ name: 'test', command: 'vitest run --reporter verbose', body: '' }],
} as const;

export const prepareAskDraft = (): void => {
  seedSessionAsk({ state: 'answer' });
  const state = useAppStore.getState();
  const threadId: ChatId | null = state.askThreadId[SESSION_ID] ?? null;
  state.setAskDraft({ sessionId: SESSION_ID, threadId, text: DRAFT });
};

export const prepareToast = (): void => {
  seedSessionAsk({ state: 'answer' });
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
