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

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandedId } from '../../../../history/testing/brandedId';
import type {
  Agent,
  IsoDateTime,
  OpenQuestion,
  OpenQuestionId,
  Session,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { anAgent, aSession } from '@goodboy/types/testing';
import { pressShortcut } from '../../../../../__tests__/helpers/pressKey';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';

let useAppStore: StoryStore;
let OverviewActions: typeof import('./index').OverviewActions;

beforeAll(async () => {
  useAppStore = await importStore();
  ({ OverviewActions } = await import('./index'));
}, STORE_IMPORT_TIMEOUT_MS);

const SESSION_ID = brandedId<SessionId>({ value: 'session-1' });

const SESSION: Session = aSession({
  id: SESSION_ID,
  workspaceId: brandedId<WorkspaceId>({ value: 'workspace-1' }),
  goal: 'Ship the thing',
});

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({ sessions: [SESSION], currentSessionId: SESSION_ID });
});

afterEach(cleanup);

const openedKind = () => useAppStore.getState().drawer?.kind ?? null;

describe('OverviewActions', () => {
  it('is a menu with one item per form, Start an auto always in it', () => {
    useAppStore.setState({ settings: { 'agents.autoExperiment': 'false' } });
    render(<OverviewActions session={SESSION} />);

    expect(screen.getByRole('button', { name: 'New' }).getAttribute('aria-haspopup')).toBe('menu');
    fireEvent.click(screen.getByRole('button', { name: 'New' }));

    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Run a workflow',
      'Run an orchestrator',
      'Start an agent',
      'Start an auto',
      'Write a report',
      'Draw a wireframe',
    ]);
  });

  it('opens the picked form in the drawer, on this session', () => {
    render(<OverviewActions session={SESSION} />);

    fireEvent.click(screen.getByRole('button', { name: 'New' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Run an orchestrator' }));

    expect(useAppStore.getState().drawer).toEqual({
      kind: 'new',
      sessionId: SESSION_ID,
      payload: { form: 'orchestrate' },
    });
    expect(screen.queryByRole('menuitem')).toBeNull();
  });

  it.each([
    ['Start an agent', 'agent'],
    ['Start an auto', 'auto'],
  ] as const)('opens %s as its own form, the roles and Auto apart', (item, form) => {
    render(<OverviewActions session={SESSION} />);

    fireEvent.click(screen.getByRole('button', { name: 'New' }));
    fireEvent.click(screen.getByRole('menuitem', { name: item }));

    expect(useAppStore.getState().drawer).toEqual({
      kind: 'new',
      sessionId: SESSION_ID,
      payload: { form },
    });
  });

  it('opens the menu with the contextual new chord, and the drawer only on a pick', async () => {
    render(<OverviewActions session={SESSION} />);

    await act(async () => pressShortcut({ id: 'overview.newHere' }));
    expect(screen.getAllByRole('menuitem').length).toBeGreaterThan(0);
    expect(openedKind()).toBeNull();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Run a workflow' }));
    expect(useAppStore.getState().drawer).toMatchObject({ payload: { form: 'run' } });
  });

  it('leaves the chord to Reset chat while the Ask panel is open', async () => {
    useAppStore.setState({ drawer: { kind: 'ask', sessionId: SESSION_ID, payload: null } });
    render(<OverviewActions session={SESSION} />);

    await act(async () => pressShortcut({ id: 'overview.newHere' }));

    expect(openedKind()).toBe('ask');
  });

  it('draws a chevron, since it opens a menu', () => {
    const { container } = render(<OverviewActions session={SESSION} />);

    expect(container.querySelector('.lucide-chevron-down')).not.toBeNull();
  });
});

const variantOf = () => screen.getByRole('button', { name: 'New' }).getAttribute('data-variant');

const agentIn = (status: Agent['status']) => anAgent({ sessionId: SESSION_ID, status });

describe('OverviewActions emphasis', () => {
  it('is primary on an empty session', () => {
    render(<OverviewActions session={SESSION} />);

    expect(variantOf()).toBe('primary');
  });

  it('stays neutral on an idle session while Next holds the filled primary', () => {
    render(<OverviewActions session={SESSION} hasNextLead />);

    expect(variantOf()).toBe('secondary');
  });

  it('is primary when every agent and run has finished', () => {
    useAppStore.setState({
      sessionPhaseRuns: { [SESSION_ID]: [agentIn('completed'), agentIn('stopped')] },
    });
    render(<OverviewActions session={SESSION} />);

    expect(variantOf()).toBe('primary');
  });

  it('stays neutral while one agent is running', () => {
    useAppStore.setState({
      sessionPhaseRuns: { [SESSION_ID]: [agentIn('completed'), agentIn('running')] },
    });
    render(<OverviewActions session={SESSION} />);

    expect(variantOf()).toBe('secondary');
  });

  it('stays neutral while one agent is blocked', () => {
    useAppStore.setState({ sessionPhaseRuns: { [SESSION_ID]: [agentIn('blocked')] } });
    render(<OverviewActions session={SESSION} />);

    expect(variantOf()).toBe('secondary');
  });

  it('stays neutral while a question is open, and turns primary once it is answered', () => {
    const question: OpenQuestion = {
      id: brandedId<OpenQuestionId>({ value: 'question-1' }),
      sessionId: SESSION_ID,
      text: 'Which ledger?',
      suggestedAnswers: [],
      isBlocking: true,
      userAnswer: null,
      status: 'open',
      createdAt: brandedId<IsoDateTime>({ value: '2026-10-14T09:00:00.000Z' }),
    };
    useAppStore.setState({
      sessionPhaseRuns: { [SESSION_ID]: [agentIn('completed')] },
      sessionOpenQuestions: { [SESSION_ID]: [question] },
    });
    render(<OverviewActions session={SESSION} />);
    expect(variantOf()).toBe('secondary');

    act(() => {
      useAppStore.setState({
        sessionOpenQuestions: { [SESSION_ID]: [{ ...question, status: 'answered' }] },
      });
    });

    expect(variantOf()).toBe('primary');
  });
});
