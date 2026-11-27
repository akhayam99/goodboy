// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArtifactId, SessionId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import { useAppStore } from '../../store';
import { PLAN_FIXTURE_ID, PLAN_FIXTURE_SESSION, aPlan } from '../../test/planFixtures';
import { brandedId } from '../history/testing/brandedId';
import { openArtifactAnywhere } from './openArtifactAnywhere';

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

const REPORT_ID = brandedId<ArtifactId>({ value: 'report-q3-ledger' });

beforeEach(() => {
  seed({ current: PLAN_FIXTURE_SESSION, lens: null });
});

describe('open an artifact from anywhere', () => {
  it('opens the panel when the artifact belongs to the page the user is on', () => {
    const opening = openArtifactAnywhere({
      sessionId: PLAN_FIXTURE_SESSION,
      artifactId: PLAN_FIXTURE_ID,
    });

    expect(opening).toBe('panel');
    expect(useAppStore.getState().drawer).toMatchObject({
      kind: 'artifact-document',
      sessionId: PLAN_FIXTURE_SESSION,
      payload: { artifactId: PLAN_FIXTURE_ID, revision: null },
    });
    expect(useAppStore.getState().currentSessionId).toBe(PLAN_FIXTURE_SESSION);
  });

  it('opens a report in the panel the same way as a plan', () => {
    openArtifactAnywhere({ sessionId: PLAN_FIXTURE_SESSION, artifactId: REPORT_ID });

    expect(useAppStore.getState().drawer).toMatchObject({
      kind: 'artifact-document',
      payload: { artifactId: REPORT_ID },
    });
  });

  it('goes to the artifact page when the user is in another session', () => {
    seed({ current: OTHER_SESSION, lens: null });

    const opening = openArtifactAnywhere({
      sessionId: PLAN_FIXTURE_SESSION,
      artifactId: PLAN_FIXTURE_ID,
    });

    expect(opening).toBe('page');
    expect(useAppStore.getState().currentSessionId).toBe(PLAN_FIXTURE_SESSION);
    expect(useAppStore.getState().activeLens[PLAN_FIXTURE_SESSION]).toBe('plans');
    expect(useAppStore.getState().drawer).toBeNull();
  });

  it('goes to the artifact page when no session is open, as from the Board', () => {
    useAppStore.setState({ currentSessionId: null });

    const opening = openArtifactAnywhere({
      sessionId: PLAN_FIXTURE_SESSION,
      artifactId: REPORT_ID,
    });

    expect(opening).toBe('page');
    expect(useAppStore.getState().currentSessionId).toBe(PLAN_FIXTURE_SESSION);
    expect(useAppStore.getState().drawer).toBeNull();
  });

  it('selects the artifact inside the Artifacts page when the user is already on it', () => {
    seed({ current: PLAN_FIXTURE_SESSION, lens: 'plans' });

    const opening = openArtifactAnywhere({
      sessionId: PLAN_FIXTURE_SESSION,
      artifactId: PLAN_FIXTURE_ID,
    });

    expect(opening).toBe('page');
    expect(useAppStore.getState().drawer).toBeNull();
    expect(useAppStore.getState().currentSessionId).toBe(PLAN_FIXTURE_SESSION);
    expect(useAppStore.getState().activeLens[PLAN_FIXTURE_SESSION]).toBe('plans');
  });

  it('replaces the open panel with the next artifact and keeps nothing behind it', () => {
    openArtifactAnywhere({ sessionId: PLAN_FIXTURE_SESSION, artifactId: PLAN_FIXTURE_ID });
    openArtifactAnywhere({ sessionId: PLAN_FIXTURE_SESSION, artifactId: REPORT_ID });

    const state = useAppStore.getState();
    expect(state.drawer).toMatchObject({ payload: { artifactId: REPORT_ID } });
    expect(state.drawerBack).toBeNull();
  });

  it('keeps one panel when the same artifact is opened again', () => {
    openArtifactAnywhere({ sessionId: PLAN_FIXTURE_SESSION, artifactId: PLAN_FIXTURE_ID });
    openArtifactAnywhere({ sessionId: PLAN_FIXTURE_SESSION, artifactId: REPORT_ID });
    openArtifactAnywhere({ sessionId: PLAN_FIXTURE_SESSION, artifactId: REPORT_ID });

    const state = useAppStore.getState();
    expect(state.drawer).toMatchObject({ payload: { artifactId: REPORT_ID } });
    expect(state.drawerBack).toBeNull();
  });

  it('goes to the artifact page when a studio is open over the same session', () => {
    useAppStore.setState({ appStudio: { kind: 'changelog' } });

    const opening = openArtifactAnywhere({
      sessionId: PLAN_FIXTURE_SESSION,
      artifactId: PLAN_FIXTURE_ID,
    });

    expect(opening).toBe('page');
    expect(useAppStore.getState().drawer).toBeNull();
    expect(useAppStore.getState().appStudio).toBeNull();
  });
});
