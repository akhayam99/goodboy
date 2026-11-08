// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../store/storyHarness')).dbModuleMock(),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { aProject, aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { branchPlace } from '../../../../../store/slices/navigation/place';
import {
  aNowRun,
  aNowStepAgent,
  aNowWorkflow,
  NOW_SESSION,
} from '../../../central/now/testing/nowModelOf';
import { aMountView } from '../../../testing/aMountView';
import { aProjectMountOf } from '../../../testing/aProjectMountOf';
import { RunHeadBranches } from './index';

const PAYMENTS = aProject({ name: 'payments-api' });
const NOTIFY = aProject({ name: 'notify-relay' });
const DUP = aMountView({
  key: 'dup',
  sessionId: NOW_SESSION,
  projectId: PAYMENTS.id,
  projectName: 'payments-api',
  branch: 'fix/duplicate-credit',
});
const RETRY = aMountView({
  key: 'retry',
  sessionId: NOW_SESSION,
  projectId: NOTIFY.id,
  projectName: 'notify-relay',
  branch: 'feat/retry-budget',
});
const RETRY_PATH = '/work/notify-relay/.goodboy/worktrees/retry-budget';

const WORKFLOW = aNowWorkflow({ key: 'harborline', name: 'Harborline', stepNames: ['Build'] });
const ATTACHED = aNowRun({ key: 'harborline', workflow: WORKFLOW });
const SESSION = aSession({ id: NOW_SESSION, workflowRuns: [ATTACHED.run] });
const STEP = aNowStepAgent({
  attached: ATTACHED,
  stepIndex: 0,
  status: 'running',
  name: 'Build',
  mountId: RETRY.id,
});

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    projects: [PAYMENTS, NOTIFY],
    sessionWorkflows: { [NOW_SESSION]: [WORKFLOW] },
    sessionPhaseRuns: { [NOW_SESSION]: [STEP] },
    sessionMounts: {
      [NOW_SESSION]: [
        { ...DUP, worktreePath: null },
        { ...RETRY, worktreePath: null },
      ],
    },
    sessionProjectMounts: {
      [NOW_SESSION]: [
        aProjectMountOf({ view: DUP }),
        aProjectMountOf({ view: RETRY, worktreePath: RETRY_PATH }),
      ],
    },
    navigate: vi.fn(),
  });
});

afterEach(cleanup);

describe('RunHeadBranches', () => {
  it('opens the Work tab of the branch the run touched, also when its session row has no worktree path', () => {
    render(<RunHeadBranches session={SESSION} runId={ATTACHED.run.id} />);

    fireEvent.click(screen.getByRole('button', { name: `Open branch ${RETRY.branch}` }));

    expect(useAppStore.getState().navigate).toHaveBeenCalledWith({
      to: branchPlace({ sessionId: NOW_SESSION, mountPath: RETRY_PATH, tab: 'work' }),
    });
  });

  it('draws the branch as plain text and opens nothing when the Branch page does not know it', () => {
    useAppStore.setState({
      sessionProjectMounts: { [NOW_SESSION]: [aProjectMountOf({ view: DUP })] },
    });

    render(<RunHeadBranches session={SESSION} runId={ATTACHED.run.id} />);

    expect(screen.queryByRole('button', { name: `Open branch ${RETRY.branch}` })).toBeNull();
    fireEvent.click(screen.getByTestId('run-branch'));
    expect(useAppStore.getState().navigate).not.toHaveBeenCalled();
  });
});
