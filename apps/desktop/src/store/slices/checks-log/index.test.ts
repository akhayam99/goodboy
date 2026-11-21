// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type PrCheckRun, type ProjectId, type WorkspaceId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../storyHarness';
import { parseCheckLog } from './parseCheckLog';

const JOB = 'https://github.com/acme/ledger-core/actions/runs/9001/job/42';
const T0 = Date.UTC(2026, 10, 21, 10, 0, 0);
const WORKSPACE = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const PROJECT = brandId<ProjectId>({ value: 'project-ledger-core' });

const check: PrCheckRun = {
  name: 'integration-tests',
  conclusion: 'failure',
  detailsUrl: JOB,
  durationMs: 1_000,
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0);
});

afterEach(() => {
  vi.useRealTimers();
});

type AnswerParams = {
  readonly stdout: string;
  readonly exitCode?: number;
};

const answerGh = ({ stdout, exitCode = 0 }: AnswerParams) => {
  storySpies.tauriInvoke.mockImplementation(async (command?: unknown) =>
    command === 'gh_run' ? { stdout, stderr: '', exitCode } : undefined,
  );
};

const read = () =>
  useAppStore.getState().readCheckLog({
    check,
    cwd: '/work/ledger-core',
    workspaceId: WORKSPACE,
    projectId: PROJECT,
  });

describe('the log reading of a failed check', () => {
  it('keeps the test the log names, whether it timed out, and the last lines', async () => {
    answerGh({
      stdout:
        ' FAIL  src/ledger/rounding.test.ts > rounds half up\nexpected 10.01 to equal 10.00\n',
    });
    await read();
    expect(useAppStore.getState().checkLogs[JOB]).toEqual({
      detailsUrl: JOB,
      status: 'ready',
      fetchedAt: new Date(T0).toISOString(),
      testFile: 'src/ledger/rounding.test.ts',
      testName: null,
      isTimeout: false,
      lines: [
        ' FAIL  src/ledger/rounding.test.ts > rounds half up',
        'expected 10.01 to equal 10.00',
      ],
    });
  });

  it('starts one read when two ask at the same moment', async () => {
    answerGh({ stdout: 'FAIL src/a.test.ts\n' });
    await Promise.all([read(), read()]);
    expect(
      storySpies.tauriInvoke.mock.calls.filter(([command]) => command === 'gh_run'),
    ).toHaveLength(1);
  });

  it('reads a log once: a finished job never changes', async () => {
    answerGh({ stdout: 'FAIL src/a.test.ts\n' });
    await read();
    await read();
    const calls = storySpies.tauriInvoke.mock.calls.filter(([command]) => command === 'gh_run');
    expect(calls).toHaveLength(1);
  });

  it('marks a log gh could not give as none, and asks again only after ten minutes', async () => {
    answerGh({ stdout: '', exitCode: 1 });
    await read();
    expect(useAppStore.getState().checkLogs[JOB]?.status).toBe('none');
    await read();
    expect(
      storySpies.tauriInvoke.mock.calls.filter(([command]) => command === 'gh_run'),
    ).toHaveLength(1);
    vi.setSystemTime(T0 + 11 * 60_000);
    answerGh({ stdout: 'FAIL src/a.test.ts\n' });
    await read();
    expect(useAppStore.getState().checkLogs[JOB]?.status).toBe('ready');
  });

  it('reads nothing for a check with no details url', async () => {
    answerGh({ stdout: 'FAIL src/a.test.ts\n' });
    await useAppStore.getState().readCheckLog({
      check: { ...check, detailsUrl: null },
      cwd: '/work/ledger-core',
      workspaceId: WORKSPACE,
      projectId: PROJECT,
    });
    expect(useAppStore.getState().checkLogs).toEqual({});
  });
});

describe('parseCheckLog', () => {
  it('keeps at most twelve lines, without blanks or colour codes', () => {
    const log = Array.from(
      { length: 30 },
      (_, index) => `\u001B[31mline ${index}\u001B[0m\n\n`,
    ).join('');
    const parsed = parseCheckLog({ log });
    expect(parsed.lines).toHaveLength(12);
    expect(parsed.lines.at(-1)).toBe('line 29');
  });

  it('spots a timeout without a test name', () => {
    expect(parseCheckLog({ log: 'step timed out after 600 seconds' })).toMatchObject({
      isTimeout: true,
      testFile: null,
      testName: null,
    });
  });
});
