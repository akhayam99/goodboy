// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { PullRequestHost } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import {
  SESSION,
  seedResolveScene,
} from '../../../../../app/components/MockScene/scenes/resolveSeed';
import type { BranchNextStep } from '../../../branchNextStepOf';
import { BranchStartPage } from './index';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  seedResolveScene({ expandedThreadId: null });
});

afterEach(() => {
  cleanup();
});

const STEP: BranchNextStep = {
  state: 'empty',
  ahead: 0,
  behind: 0,
  unpushed: 0,
  isPushed: false,
  diverged: null,
  header: null,
  submit: null,
};

type ShowParams = {
  readonly host: PullRequestHost;
  readonly step?: BranchNextStep;
};

const show = ({ host, step = STEP }: ShowParams): void => {
  render(
    <BranchStartPage
      hostForm={null}
      host={host}
      session={SESSION}
      mountPath={null}
      branch="hl/fix-duplicate-credit"
      step={step}
      configuredBase={null}
      commits={[]}
      conflictFiles={['src/ledger.ts']}
      isConnected
      onConnected={() => undefined}
      onCreated={() => undefined}
    />,
  );
};

describe('the start of a branch without a request', () => {
  it('names a pull request on GitHub', () => {
    show({ host: 'github' });

    screen.getByText('Commit on this branch to start a pull request');
  });

  it('names a merge request on GitLab', () => {
    show({ host: 'gitlab' });

    screen.getByText('Commit on this branch to start a merge request');
  });

  it('names the merge request form behind a rebase conflict on GitLab', () => {
    show({ host: 'gitlab', step: { ...STEP, state: 'conflict' } });

    screen.getByText(/The merge request form comes back/);
  });
});
