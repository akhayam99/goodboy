// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('../ChatView', () => ({ ChatView: () => <div data-testid="drawer-transcript" /> }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Agent, AgentId } from '@goodboy/types';
import { ToastProvider, useToast } from '../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { SESSION, SESSION_ID } from '../../../../app/components/MockScene/scenes/resolveSeed';
import { AgentTranscriptDrawer } from '.';

const RESOLVER = 'agent-fix-lift' as AgentId;
const DOCK_HEIGHT = 136;
const LIFT_GAP = 8;

const RESOLVER_AGENT: Agent = {
  id: RESOLVER,
  sessionId: SESSION_ID,
  ordinal: 1,
  name: 'resolve: retry backoff',
  kind: 'resolver',
  status: 'running',
};

const ShowToast = () => {
  const { showToast } = useToast();
  return (
    <button type="button" onClick={() => showToast({ kind: 'info', message: 'Run started' })}>
      Toast
    </button>
  );
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    sessions: [SESSION],
    currentSessionId: SESSION_ID,
    sessionPhaseRuns: { [SESSION_ID]: [RESOLVER_AGENT] },
  });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    top: window.innerHeight - DOCK_HEIGHT,
    bottom: window.innerHeight,
    left: 0,
    right: 0,
    width: 0,
    height: DOCK_HEIGHT,
  } as DOMRect);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const mount = () =>
  render(
    <ToastProvider>
      <ShowToast />
      <AgentTranscriptDrawer sessionId={SESSION_ID} agentId={RESOLVER} onClose={() => undefined} />
    </ToastProvider>,
  );

describe('the transcript drawer and the toast stack', () => {
  it('lifts a toast above the reply field, so it never covers Send', () => {
    mount();

    expect(screen.getByRole('button', { name: 'Send' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Toast' }));

    expect(screen.getByRole('status').parentElement?.style.bottom).toBe(
      `${DOCK_HEIGHT + LIFT_GAP}px`,
    );
  });

  it('leaves the stack where it is while the run has ended and no reply field shows', () => {
    useAppStore.setState({
      sessionPhaseRuns: { [SESSION_ID]: [{ ...RESOLVER_AGENT, status: 'completed' }] },
      agentTurnState: { [RESOLVER]: { kind: 'ended', endedAt: SESSION.updatedAt } },
    });
    mount();

    fireEvent.click(screen.getByRole('button', { name: 'Toast' }));

    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();
    expect(screen.getByRole('status').parentElement?.style.bottom).toBe('');
  });
});
