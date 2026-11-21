import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { brandId, type MountId } from '@goodboy/types';
import { nextSessionId } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';

const SESSION_ID = nextSessionId();
const MOUNT = brandId<MountId>({ value: 'mount-ledger-core' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

const record = ({ exitCode }: { readonly exitCode: number }) =>
  useAppStore.getState().recordTerminalScriptRun({
    sessionId: SESSION_ID,
    scriptId: 'script-db-migrate',
    name: 'db:migrate',
    mountId: MOUNT,
    exitCode,
    startedAt: 1_000,
  });

describe('recordTerminalScriptRun', () => {
  it('writes an ok run for exit code 0 under the script of that mount, so Scripts and Next agree', () => {
    record({ exitCode: 0 });
    const run = useAppStore.getState().scriptRuns[SESSION_ID]?.['script-db-migrate'];
    expect(run?.status).toBe('ok');
    expect(run?.mountId).toBe(MOUNT);
    expect(run?.name).toBe('db:migrate');
    expect(run?.startedAt).toBe(1_000);
  });

  it('writes an error run for a non-zero exit', () => {
    record({ exitCode: 3 });
    const run = useAppStore.getState().scriptRuns[SESSION_ID]?.['script-db-migrate'];
    expect(run?.status).toBe('error');
    expect(run?.result?.exitCode).toBe(3);
  });

  it('leaves a run that is still going alone', () => {
    useAppStore.setState({
      scriptRuns: {
        [SESSION_ID]: {
          'script-db-migrate': { status: 'pending', result: null, runId: 'run-live', startedAt: 5 },
        },
      },
    });
    record({ exitCode: 0 });
    expect(useAppStore.getState().scriptRuns[SESSION_ID]?.['script-db-migrate']?.runId).toBe(
      'run-live',
    );
  });
});
