// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import { useAppStore } from '../../store';
import { PLAN_FIXTURE_ID, PLAN_FIXTURE_SESSION, aPlan } from '../../test/planFixtures';
import { openPlanAnywhere } from './openPlanAnywhere';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../store/storyHarness')).dbModuleMock());
vi.mock('../../shared/lib/db', async () =>
  (await import('../../store/storyHarness')).dbLibModuleMock(),
);

const OTHER_SESSION = 'session-northwind' as SessionId;

const seed = ({
  current,
  lens,
}: {
  readonly current: SessionId;
  readonly lens: 'plans' | null;
}) => {
  useAppStore.setState({
    ...useAppStore.getInitialState(),
    sessions: [aSession({ id: PLAN_FIXTURE_SESSION }), aSession({ id: OTHER_SESSION })],
    sessionPlans: { [PLAN_FIXTURE_SESSION]: [aPlan()] },
    currentSessionId: current,
    activeLens: { [PLAN_FIXTURE_SESSION]: lens },
  });
};

beforeEach(() => {
  seed({ current: PLAN_FIXTURE_SESSION, lens: null });
});

describe('open a plan from anywhere', () => {
  it('opens the drawer over the page the user is on', () => {
    openPlanAnywhere({ sessionId: PLAN_FIXTURE_SESSION, planId: PLAN_FIXTURE_ID });

    expect(useAppStore.getState().drawer).toMatchObject({
      kind: 'artifact-document',
      sessionId: PLAN_FIXTURE_SESSION,
      payload: { artifactId: PLAN_FIXTURE_ID, revision: null },
    });
    expect(useAppStore.getState().currentSessionId).toBe(PLAN_FIXTURE_SESSION);
  });

  it('opens the drawer on the plan session when the user is in another one', () => {
    seed({ current: OTHER_SESSION, lens: null });

    openPlanAnywhere({ sessionId: PLAN_FIXTURE_SESSION, planId: PLAN_FIXTURE_ID });

    expect(useAppStore.getState().currentSessionId).toBe(PLAN_FIXTURE_SESSION);
    expect(useAppStore.getState().drawer).toMatchObject({
      kind: 'artifact-document',
      sessionId: PLAN_FIXTURE_SESSION,
      payload: { artifactId: PLAN_FIXTURE_ID, revision: null },
    });
  });

  it('selects the plan inside the Artifacts page when the user is already on it', () => {
    seed({ current: PLAN_FIXTURE_SESSION, lens: 'plans' });

    openPlanAnywhere({ sessionId: PLAN_FIXTURE_SESSION, planId: PLAN_FIXTURE_ID });

    expect(useAppStore.getState().drawer).toBeNull();
    expect(useAppStore.getState().currentSessionId).toBe(PLAN_FIXTURE_SESSION);
    expect(useAppStore.getState().activeLens[PLAN_FIXTURE_SESSION]).toBe('plans');
  });
});
