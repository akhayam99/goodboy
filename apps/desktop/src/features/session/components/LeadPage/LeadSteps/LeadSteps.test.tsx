// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import type { AutoGuideView, AutoTreeView } from '../../../../../store/slices/auto-view/state';
import { FIXTURE_ROOT, FIXTURE_SESSION, aView } from '../../../../auto/testing/autoViewFixtures';
import { LeadSteps } from './index';

let useAppStore: StoryStore;

const GUIDE: AutoGuideView = {
  workflowId: 'workflow-feature',
  name: 'Ship a feature',
  check: 'passed',
  steps: [
    { name: 'Find what it touches', role: 'scout' },
    { name: 'Build it', role: 'implementer' },
  ],
  deviations: [
    { change: 'skipped', step: 'Find what it touches', reason: 'findings carried over' },
    { change: 'added', step: 'Add a rounding mode flag', reason: 'Both modes are needed.' },
  ],
};

const show = (view: AutoTreeView) => {
  useAppStore.setState({ autoTreeViews: { [FIXTURE_SESSION]: [view] } });
  return render(<LeadSteps sessionId={FIXTURE_SESSION} rootAgentId={FIXTURE_ROOT} />);
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
});

describe('LeadSteps', () => {
  it('lists the usual steps with the skipped and the added ones marked', () => {
    show({ ...aView(), guide: GUIDE });

    screen.getByRole('region', { name: 'Usual steps' });
    const items = [...document.querySelectorAll('li[data-step-state]')];
    expect(items.map((item) => item.getAttribute('data-step-state'))).toEqual([
      'skipped',
      'queued',
      'added',
    ]);
    screen.getByText('Skipped: findings carried over');
    screen.getByRole('button', { name: 'Why the Lead added this step' });
  });

  it('draws nothing for a run with no workflow', () => {
    show({ ...aView(), guide: null });

    expect(screen.queryByRole('region', { name: 'Usual steps' })).toBeNull();
  });
});
