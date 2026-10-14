// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

const mount = vi.hoisted(() => {
  const holder: { current: import('../../../inbox/launchMountFor').LaunchMount | null } = {
    current: null,
  };
  return holder;
});

vi.mock('../../../inbox/useLaunchMount', () => ({
  useLaunchMount: () => mount.current,
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { ProjectId } from '@goodboy/types';
import { brandedId } from '../../../history/testing/brandedId';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  WORKSPACE_ID,
  seedBoardScene,
} from '../../../../app/components/MockScene/scenes/BoardScene';
import type { IssueCandidate } from '../../../integrations/fetchIssueCandidates';
import { HowToWorkOnIt } from './HowToWorkOnIt';

const PAYMENTS = brandedId<ProjectId>({ value: 'project-payments-api' });
const LEDGER = brandedId<ProjectId>({ value: 'project-ledger-core' });

const CANDIDATE: IssueCandidate = {
  provider: 'github',
  externalId: '412',
  identifier: 'HBL-412',
  title: 'Stop retried webhooks posting a second credit',
  url: 'https://github.com/harborline/payments-api/issues/412',
  goal: 'Retried webhooks post a second credit in payments-api.',
  body: 'Retried webhooks post a second credit in payments-api.',
  branchSlug: 'stop-retried-webhooks',
};

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  seedBoardScene();
  mount.current = null;
});

afterEach(cleanup);

const show = () =>
  render(
    <ToastProvider>
      <HowToWorkOnIt
        workspaceId={WORKSPACE_ID}
        candidates={[CANDIDATE]}
        title={CANDIDATE.title}
        goal={CANDIDATE.goal}
        onGoalChange={() => undefined}
      />
    </ToastProvider>,
  );

describe('HowToWorkOnIt, where the work happens', () => {
  it('says the project in one plain line, with no chip, when it is unambiguous', () => {
    mount.current = {
      options: [{ projectId: PAYMENTS, name: 'payments-api' }],
      selectedId: PAYMENTS,
      reason: 'from GitHub repo harborline/payments-api',
    };

    show();

    expect(
      screen.getByText('In payments-api, from GitHub repo harborline/payments-api.'),
    ).toBeDefined();
    expect(screen.queryByRole('combobox', { name: 'Project to work in' })).toBeNull();
  });

  it('keeps the project chip when more than one project fits', () => {
    mount.current = {
      options: [
        { projectId: PAYMENTS, name: 'payments-api' },
        { projectId: LEDGER, name: 'ledger-core' },
      ],
      selectedId: PAYMENTS,
      reason: 'from GitHub repo harborline/payments-api',
    };

    show();

    expect(screen.getByRole('combobox', { name: 'Project to work in' })).toBeDefined();
  });

  it('labels the way to start with Then:', () => {
    show();

    expect(screen.getByText('Then:')).toBeDefined();
    expect(screen.getByRole('tablist', { name: 'How to work on it' })).toBeDefined();
  });
});
