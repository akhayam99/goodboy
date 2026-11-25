// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { RunRoute } from '@goodboy/types';
import { aSession, aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import type { AutoGuideView } from '../../../../../store/slices/auto-view/state';
import { FIXTURE_ROOT, FIXTURE_SESSION, aView } from '../../../../auto/testing/autoViewFixtures';
import { runRoutesKey } from '../../../startRun/runRoutesSetting';
import { AgentRunRoute } from './index';

const WORKSPACE = aWorkspace({ name: 'Harborline' });
const SESSION = aSession({ id: FIXTURE_SESSION, workspaceId: WORKSPACE.id });

const ROUTE: RunRoute = {
  shape: 'lead',
  row: 1,
  presetName: 'Ship a feature',
  closeness: 'adapt',
  role: null,
  choice: 'Lead · plan Ship a feature',
  why: 'Your ask matches the workflow',
  ask: 'Round each line to the cent',
};

const GUIDE: AutoGuideView = {
  workflowId: 'workflow-feature',
  name: 'Ship a feature',
  check: 'passed',
  steps: [{ name: 'Build it', role: 'implementer' }],
  deviations: [
    { change: 'added', step: 'Add a flag', reason: 'Both modes are needed.' },
    { change: 'skipped', step: 'Build it', reason: 'Nothing to build.' },
  ],
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
});

const open = (guide: AutoGuideView | null) => {
  useAppStore.setState({
    settings: {
      [runRoutesKey({ sessionId: SESSION.id })]: JSON.stringify({ [FIXTURE_ROOT]: ROUTE }),
    },
    loadSetting: async () => null,
    autoTreeViews: { [SESSION.id]: [{ ...aView(), guide }] },
  });
  render(<AgentRunRoute session={SESSION} agentId={FIXTURE_ROOT} />);
  fireEvent.click(screen.getByRole('button', { name: /^Kind:/ }));
  return screen.getByRole('dialog', { name: 'Kind' });
};

describe('AgentRunRoute', () => {
  it('counts the deviations the Lead recorded', () => {
    const dialog = open(GUIDE);

    within(dialog).getByText(/2 changes/);
  });

  it('counts nothing for a run that kept its steps', () => {
    const dialog = open({ ...GUIDE, deviations: [] });

    expect(within(dialog).queryByText(/change/)).toBeNull();
  });
});
