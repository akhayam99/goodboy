// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandedId } from '../../../features/history/testing/brandedId';
import { act, cleanup, render } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import { useAppStore } from '../../../store';
import { PLAN_FIXTURE_ID, PLAN_FIXTURE_SESSION, aPlan } from '../../../test/planFixtures';
import { useSessionSurfaceEvents } from './useSessionSurfaceEvents';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);

const close = vi.fn();

const Probe = () => {
  useSessionSurfaceEvents({
    close,
    currentSession: null,
    currentWorkspace: null,
    isSessionSidebarCollapsed: false,
    pinSessionSidebar: () => undefined,
  });
  return null;
};

const fire = ({ detail }: { readonly detail: Readonly<Record<string, string>> }) => {
  act(() => {
    window.dispatchEvent(new CustomEvent('goodboy:open-plan-studio', { detail }));
  });
};

beforeEach(() => {
  close.mockClear();
  useAppStore.setState({
    ...useAppStore.getInitialState(),
    sessions: [aSession({ id: PLAN_FIXTURE_SESSION })],
    sessionPlans: { [PLAN_FIXTURE_SESSION]: [aPlan()] },
    currentSessionId: PLAN_FIXTURE_SESSION,
    activeLens: { [PLAN_FIXTURE_SESSION]: null },
  });
  render(<Probe />);
});

afterEach(cleanup);

const fireBuilder = ({ detail }: { readonly detail: Readonly<Record<string, string>> }) => {
  act(() => {
    window.dispatchEvent(new CustomEvent('goodboy:open-workflow-builder', { detail }));
  });
};

describe('the open workflow builder event', () => {
  it('opens the New drawer on the Run tab and leaves the page where it is', () => {
    fireBuilder({ detail: { sessionId: PLAN_FIXTURE_SESSION } });

    expect(close).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().drawer).toEqual({
      kind: 'new',
      sessionId: PLAN_FIXTURE_SESSION,
      payload: { tab: 'run' },
    });
    expect(useAppStore.getState().activeLens[PLAN_FIXTURE_SESSION]).toBeNull();
  });

  it('goes to the session the event names before it opens the drawer', () => {
    const other = aSession({ id: brandedId<SessionId>({ value: 'session-other' }) });
    useAppStore.setState({ sessions: [aSession({ id: PLAN_FIXTURE_SESSION }), other] });

    fireBuilder({ detail: { sessionId: other.id } });

    expect(useAppStore.getState().currentSessionId).toBe(other.id);
    expect(useAppStore.getState().drawer).toMatchObject({ kind: 'new', sessionId: other.id });
  });

  it('opens the New drawer on the current session when the event names none', () => {
    fireBuilder({ detail: {} });

    expect(close).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().drawer).toEqual({
      kind: 'new',
      sessionId: PLAN_FIXTURE_SESSION,
      payload: { tab: 'run' },
    });
    expect(useAppStore.getState().currentSessionId).toBe(PLAN_FIXTURE_SESSION);
  });

  it('does nothing when the event names no session and no session is open', () => {
    useAppStore.setState({ currentSessionId: null });

    fireBuilder({ detail: {} });

    expect(useAppStore.getState().drawer).toBeNull();
    expect(useAppStore.getState().currentSessionId).toBeNull();
    expect(close).not.toHaveBeenCalled();
  });
});

describe('the open plan event', () => {
  it('opens the plan in the drawer and leaves the page where it is', () => {
    fire({ detail: { sessionId: PLAN_FIXTURE_SESSION, planId: PLAN_FIXTURE_ID } });

    expect(close).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().drawer).toMatchObject({
      kind: 'artifact-document',
      sessionId: PLAN_FIXTURE_SESSION,
      payload: { artifactId: PLAN_FIXTURE_ID, revision: null },
    });
    expect(useAppStore.getState().activeLens[PLAN_FIXTURE_SESSION]).toBeNull();
  });

  it('opens the Artifacts page when the event names no plan', () => {
    fire({ detail: { sessionId: PLAN_FIXTURE_SESSION } });

    expect(useAppStore.getState().drawer).toBeNull();
    expect(useAppStore.getState().activeLens[PLAN_FIXTURE_SESSION]).toBe('plans');
  });
});
