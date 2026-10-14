// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('../ChatView', () => ({
  ChatView: () => <div data-testid="drawer-transcript" />,
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Agent, TurnEvent } from '@goodboy/types';
import { TEST_NOW, nextAgentId, nextProviderRunId } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { SESSION, SESSION_ID } from '../../../../app/components/MockScene/scenes/resolveSeed';
import { AgentTranscriptDrawer } from '.';

const RESOLVER = nextAgentId();
const RUN_ID = nextProviderRunId();

const RESOLVER_AGENT: Agent = {
  id: RESOLVER,
  sessionId: SESSION_ID,
  ordinal: 1,
  name: 'resolve: retry backoff',
  kind: 'resolver',
  status: 'running',
};

const eventOf = ({ text }: { readonly text: string }): TurnEvent => ({
  kind: 'assistant_text',
  runId: RUN_ID,
  delta: text,
  at: TEST_NOW,
});

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    sessions: [SESSION],
    currentSessionId: SESSION_ID,
    selectedAgentId: { [SESSION_ID]: null },
    sessionPhaseRuns: { [SESSION_ID]: [RESOLVER_AGENT] },
    transcripts: { [RESOLVER]: [eventOf({ text: 'Reading the retry loop.' })] },
  });
});

afterEach(cleanup);

type DrawerProps = {
  readonly isLeadPreferred?: boolean;
  readonly leadAlertCount?: number;
};

const drawer = ({ isLeadPreferred = false, leadAlertCount = 0 }: DrawerProps) => (
  <AgentTranscriptDrawer
    sessionId={SESSION_ID}
    agentId={RESOLVER}
    lead={<p>Fix run summary</p>}
    isLeadPreferred={isLeadPreferred}
    leadAlertCount={leadAlertCount}
    onClose={() => undefined}
  />
);

const tabNamed = (name: string): HTMLElement =>
  screen.getByRole('tab', { name: new RegExp(`^${name}`) });

const isSelected = (name: string): boolean =>
  tabNamed(name).getAttribute('aria-selected') === 'true';

const addTranscriptEvent = (): void => {
  act(() => {
    useAppStore.setState({
      transcripts: {
        [RESOLVER]: [
          ...(useAppStore.getState().transcripts[RESOLVER] ?? []),
          eventOf({ text: 'Running the typecheck.' }),
        ],
      },
    });
  });
};

describe('the fix run drawer tabs', () => {
  it('opens on Transcript while the run works, with the reply field and no summary', () => {
    render(drawer({}));

    expect(isSelected('Transcript')).toBe(true);
    expect(screen.getByTestId('drawer-transcript')).toBeDefined();
    expect(screen.getByRole('textbox', { name: 'Message to Fix run' })).toBeDefined();
    expect(screen.queryByText('Fix run summary')).toBeNull();
  });

  it('opens on Fix when the run ended or asks, with no reply field and no transcript', () => {
    render(drawer({ isLeadPreferred: true, leadAlertCount: 1 }));

    expect(isSelected('Fix')).toBe(true);
    expect(screen.getByText('Fix run summary')).toBeDefined();
    expect(screen.queryByTestId('drawer-transcript')).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Message to Fix run' })).toBeNull();
  });

  it('shows the reply field on Transcript only', () => {
    render(drawer({ isLeadPreferred: true }));

    fireEvent.click(tabNamed('Transcript'));
    expect(screen.getByRole('textbox', { name: 'Message to Fix run' })).toBeDefined();

    fireEvent.click(tabNamed('Fix'));
    expect(screen.queryByRole('textbox', { name: 'Message to Fix run' })).toBeNull();
  });

  it('keeps the tab the user picked when the run state changes', () => {
    const view = render(drawer({}));

    fireEvent.click(tabNamed('Transcript'));
    view.rerender(drawer({ isLeadPreferred: true, leadAlertCount: 1 }));
    expect(isSelected('Transcript')).toBe(true);

    fireEvent.click(tabNamed('Fix'));
    view.rerender(drawer({ isLeadPreferred: false }));
    expect(isSelected('Fix')).toBe(true);
  });

  it('follows the run state until the user picks a tab', () => {
    const view = render(drawer({}));

    view.rerender(drawer({ isLeadPreferred: true }));

    expect(isSelected('Fix')).toBe(true);
  });

  it('marks Transcript when something new arrives while Fix is shown, and clears it on open', () => {
    render(drawer({ isLeadPreferred: true }));
    expect(screen.queryByRole('status', { name: 'New activity' })).toBeNull();

    addTranscriptEvent();
    expect(screen.getByRole('status', { name: 'New activity' })).toBeDefined();

    fireEvent.click(tabNamed('Transcript'));
    expect(screen.queryByRole('status', { name: 'New activity' })).toBeNull();
  });

  it('marks Fix when a question arrives while Transcript is shown, and clears it on open', () => {
    const view = render(drawer({}));
    expect(screen.queryByRole('status', { name: 'Question waiting' })).toBeNull();

    fireEvent.click(tabNamed('Transcript'));
    view.rerender(drawer({ leadAlertCount: 1 }));
    expect(screen.getByRole('status', { name: 'Question waiting' })).toBeDefined();

    fireEvent.click(tabNamed('Fix'));
    expect(screen.queryByRole('status', { name: 'Question waiting' })).toBeNull();
  });

  it('does not mark the tab that is shown', () => {
    render(drawer({}));

    addTranscriptEvent();

    expect(screen.queryByRole('status', { name: 'New activity' })).toBeNull();
  });

  it('moves between the tabs with the arrow keys', () => {
    render(drawer({ isLeadPreferred: true }));

    fireEvent.keyDown(tabNamed('Fix'), { key: 'ArrowRight' });
    expect(isSelected('Transcript')).toBe(true);

    fireEvent.keyDown(tabNamed('Transcript'), { key: 'ArrowLeft' });
    expect(isSelected('Fix')).toBe(true);
  });

  it('adds no tabs to a drawer without a lead', () => {
    render(
      <AgentTranscriptDrawer sessionId={SESSION_ID} agentId={RESOLVER} onClose={() => undefined} />,
    );

    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Message to Fix run' })).toBeDefined();
  });
});
