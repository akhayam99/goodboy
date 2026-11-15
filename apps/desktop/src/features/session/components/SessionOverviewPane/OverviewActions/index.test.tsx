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
import type { Agent, Session, SessionId, WorkspaceId } from '@goodboy/types';
import { anAgent, aSession } from '@goodboy/types/testing';
import { pressShortcut } from '../../../../../__tests__/helpers/pressKey';
import { startRunEventName } from '../../../startRun/startRunEventName';
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
  it('is a menu of Start a run, Write a report and Draw a wireframe, with no other start', () => {
    render(<OverviewActions session={SESSION} />);

    expect(screen.getByRole('button', { name: 'New' }).getAttribute('aria-haspopup')).toBe('menu');
    fireEvent.click(screen.getByRole('button', { name: 'New' }));

    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Start a run',
      'Write a report',
      'Draw a wireframe',
    ]);
  });

  it('opens the picked form in the drawer, on this session', () => {
    render(<OverviewActions session={SESSION} />);

    fireEvent.click(screen.getByRole('button', { name: 'New' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Write a report' }));

    expect(useAppStore.getState().drawer).toEqual({
      kind: 'new',
      sessionId: SESSION_ID,
      payload: { form: 'report' },
    });
    expect(screen.queryByRole('menuitem')).toBeNull();
  });

  it('opens Start a run on Runs from the menu, with no drawer', async () => {
    const started = new Promise<unknown>((resolve) => {
      window.addEventListener(
        startRunEventName({ sessionId: SESSION_ID }),
        (event) => resolve(event instanceof CustomEvent ? event.detail : null),
        { once: true },
      );
    });
    render(<OverviewActions session={SESSION} />);

    fireEvent.click(screen.getByRole('button', { name: 'New' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Start a run' }));

    expect(useAppStore.getState().drawer).toBeNull();
    expect(useAppStore.getState().activeLens[SESSION_ID]).toBe('workflows');
    await expect(started).resolves.toEqual({ text: '' });
  });

  it('opens the menu with the contextual new chord, and the drawer only on a pick', async () => {
    render(<OverviewActions session={SESSION} />);

    await act(async () => pressShortcut({ id: 'overview.newHere' }));
    expect(screen.getAllByRole('menuitem').length).toBeGreaterThan(0);
    expect(openedKind()).toBeNull();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Draw a wireframe' }));
    expect(useAppStore.getState().drawer).toMatchObject({ payload: { form: 'wireframe' } });
  });

  it('draws a chevron, since it opens a menu', () => {
    const { container } = render(<OverviewActions session={SESSION} />);

    expect(container.querySelector('.lucide-chevron-down')).not.toBeNull();
  });
});

const variantOf = () => screen.getByRole('button', { name: 'New' }).getAttribute('data-variant');

const agentIn = (status: Agent['status']) => anAgent({ sessionId: SESSION_ID, status });

describe('OverviewActions emphasis', () => {
  it('stays the outline button on an empty session', () => {
    render(<OverviewActions session={SESSION} />);

    expect(variantOf()).toBe('secondary');
  });

  it('stays the outline button once every agent has finished', () => {
    useAppStore.setState({
      sessionPhaseRuns: { [SESSION_ID]: [agentIn('completed'), agentIn('stopped')] },
    });
    render(<OverviewActions session={SESSION} />);

    expect(variantOf()).toBe('secondary');
  });

  it('stays the outline button while an agent runs or is blocked', () => {
    useAppStore.setState({
      sessionPhaseRuns: { [SESSION_ID]: [agentIn('running'), agentIn('blocked')] },
    });
    render(<OverviewActions session={SESSION} />);

    expect(variantOf()).toBe('secondary');
  });
});
