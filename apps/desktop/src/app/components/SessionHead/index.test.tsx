// @vitest-environment happy-dom

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

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { brandId } from '@goodboy/types';
import type { LensKind } from '../../../store';
import type { TerminalTabId } from '../../../shared/types/terminal';
import { selectDetailDrawer } from '../../../store/slices/drawer/selectDetailDrawer';
import { selectDockDrawer } from '../../../store/slices/drawer/selectDockDrawer';
import { ToastProvider } from '../../../shared/components/Toast';
import { installFakeResizeObserver } from '../../../test/fakeResizeObserver';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { SessionWorkspace } from '../../../features/session/components/SessionWorkspace';
import { SessionHeadContext } from '../../../features/session/sessionHeadContext';
import { escapeLadder } from '../../../features/session/escapeLadder';
import { captureLocation } from '../../../store/slices/navigation/captureLocation';
import { sessionPlace } from '../../../store/slices/navigation/place';
import type { Place } from '../../../store/slices/navigation/types';
import {
  CHAT_ARTIFACTS,
  FLOW_SESSION,
  FLOW_SESSION_ID,
  NOW,
  SESSIONS,
} from '../MockScene/scenes/flow-audit/fixtures';
import { seedShellChrome } from '../MockScene/scenes/shellChrome';
import { seedWorkflowRun } from '../MockScene/scenes/flow-audit/seeds';
import { SessionHead } from '.';

const TABS: ReadonlyArray<readonly [string, LensKind | null]> = [
  ['Overview', null],
  ['Runs', 'workflows'],
  ['Artifacts', 'plans'],
  ['Questions', 'questions'],
  ['Context', 'context'],
];

const FIRST_ARTIFACT_ID = CHAT_ARTIFACTS[0]?.id ?? null;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  installFakeResizeObserver();
  await resetStoryStore();
  seedWorkflowRun();
  seedShellChrome({
    session: FLOW_SESSION,
    siblings: SESSIONS.filter((candidate) => candidate.id !== FLOW_SESSION.id),
    branches: {},
    telemetryAt: NOW,
    lens: null,
  });
  useAppStore.setState({
    currentWorkspaceId: FLOW_SESSION.workspaceId,
    selectedAgentId: {},
    sessionProjectMounts: {},
    navigate: useAppStore.getInitialState().navigate,
  });
});

const ARTIFACT_PLACE = sessionPlace({
  sessionId: FLOW_SESSION_ID,
  lens: 'plans',
  target: FIRST_ARTIFACT_ID === null ? null : { kind: 'artifact', artifactId: FIRST_ARTIFACT_ID },
});

afterEach(cleanup);

type GoParams = {
  readonly to: Place;
};

const go = ({ to }: GoParams): void => {
  act(() => useAppStore.getState().navigate({ to }));
};

const renderWorkspace = () =>
  render(
    <ToastProvider>
      <SessionHeadContext.Provider value={SessionHead}>
        <SessionWorkspace session={FLOW_SESSION} />
      </SessionHeadContext.Provider>
    </ToastProvider>,
  );

const headOf = (): HTMLElement => {
  const heads = document.querySelectorAll<HTMLElement>('[data-session-head]');
  expect(heads).toHaveLength(1);
  const head = heads[0];
  if (head === undefined) {
    throw new Error('no session head');
  }
  return head;
};

type HeadShape = {
  readonly nav: string | null;
  readonly isFirstRow: boolean;
  readonly headClass: string;
  readonly rowClass: string | null;
  readonly title: string | null;
  readonly pageTitles: ReadonlyArray<string>;
};

const shapeOf = (): HeadShape => {
  const head = headOf();
  const workspace = head.closest('[data-page-column]')?.parentElement ?? null;
  const row = head.querySelector('[data-slot="pane-title-row"]');
  const pageTitles = [...document.querySelectorAll('[data-page-header] h1')]
    .filter((title) => title.closest('[inert]') === null)
    .map((title) => title.textContent ?? '');
  return {
    nav: head.getAttribute('data-head-nav'),
    isFirstRow: workspace?.firstElementChild === head.closest('[data-page-column]'),
    headClass: head.className,
    rowClass: row?.className ?? null,
    title: head.querySelector('[data-testid="overview-title"]')?.textContent ?? null,
    pageTitles,
  };
};

const titleRowLabels = (): ReadonlyArray<string> => {
  const row = headOf().querySelector('[data-slot="pane-title-row"]');
  return [...(row?.querySelectorAll('button') ?? [])]
    .filter((button) => !button.hasAttribute('data-session-back'))
    .map((button) => button.getAttribute('aria-label') ?? button.textContent?.trim() ?? '')
    .slice(1);
};

const crumbLabels = (): ReadonlyArray<string> =>
  [...document.querySelectorAll('[data-session-crumbs] li')].map(
    (crumb) => crumb.textContent ?? '',
  );

describe('the session head', () => {
  it('renders the same title row and tab strip at the same top on every session tab', () => {
    const shapes = TABS.map(([name, lens]) => {
      go({ to: sessionPlace({ sessionId: FLOW_SESSION_ID, lens }) });
      const view = renderWorkspace();
      const shape = shapeOf();
      const selected = document.querySelector('[data-session-head] [aria-selected="true"]');
      expect(selected?.textContent, name).toContain(name);
      view.unmount();
      return shape;
    });

    const first = shapes[0];
    expect(first?.nav).toBe('tabs');
    expect(first?.isFirstRow).toBe(true);
    expect(first?.title).toContain('Stop retried webhooks');
    for (const shape of shapes) {
      expect(shape).toEqual(first);
      expect(shape.pageTitles).toEqual([]);
    }
  });

  it('holds only New and More in the title row on every tab', () => {
    go({ to: sessionPlace({ sessionId: FLOW_SESSION_ID, lens: 'context' }) });
    renderWorkspace();

    expect(titleRowLabels()).toEqual(['New', 'More session actions']);
  });

  it('lists Pin, Link work, Copy, Archive and Delete in More session actions', () => {
    go({ to: sessionPlace({ sessionId: FLOW_SESSION_ID, lens: 'context' }) });
    renderWorkspace();

    fireEvent.click(screen.getByRole('button', { name: 'More session actions' }));

    const rows = screen
      .getAllByRole('menuitem')
      .map((row) => row.textContent?.replace(/\s+/g, ' ').trim() ?? '');
    expect(rows).toHaveLength(5);
    for (const [index, word] of [
      'Pin session',
      'Link work',
      'Copy',
      'Archive',
      'Delete',
    ].entries()) {
      expect(rows[index]).toContain(word);
    }
    expect(rows.some((row) => row.includes('Ask about this session'))).toBe(false);
    expect(rows.some((row) => row.includes('Refresh session'))).toBe(false);
  });

  it('opens Ask beside the dock and keeps it out of the Context tab', () => {
    go({ to: sessionPlace({ sessionId: FLOW_SESSION_ID, lens: 'context' }) });
    renderWorkspace();
    act(() =>
      useAppStore.getState().openDrawer({
        kind: 'terminal',
        sessionId: FLOW_SESSION_ID,
        payload: { terminalId: brandId<TerminalTabId>({ value: 'term-ledger' }) },
      }),
    );

    expect(document.querySelector('[data-testid="context-ask"]')).toBeNull();
    act(() => useAppStore.getState().openAsk({ sessionId: FLOW_SESSION_ID }));

    expect(selectDetailDrawer({ state: useAppStore.getState() })).toMatchObject({
      kind: 'ask',
      sessionId: FLOW_SESSION_ID,
    });
    expect(selectDockDrawer({ state: useAppStore.getState() })?.kind).toBe('terminal');
  });

  it('keeps one menu on a detail page: the title row holds New and no session menu', async () => {
    go({ to: ARTIFACT_PLACE });
    renderWorkspace();
    await waitFor(() => expect(headOf().getAttribute('data-head-nav')).toBe('crumbs'));

    expect(titleRowLabels()).toEqual(['New']);
  });

  it('replaces the tabs with Session, Artifacts and the item on an artifact', async () => {
    expect(FIRST_ARTIFACT_ID).not.toBeNull();
    go({ to: ARTIFACT_PLACE });
    renderWorkspace();

    await waitFor(() => expect(headOf().getAttribute('data-head-nav')).toBe('crumbs'));
    const labels = crumbLabels();
    expect(labels[0]).toBe('Overview');
    expect(labels[1]).toBe('Artifacts');
    expect(labels).toHaveLength(3);
    expect(headOf().querySelector('[aria-current="page"]')?.textContent).toBe(labels[2]);
  });

  it('puts a back button before the title on a detail and none on a tab', async () => {
    go({ to: sessionPlace({ sessionId: FLOW_SESSION_ID, lens: 'plans' }) });
    const tab = renderWorkspace();
    expect(document.querySelector('[data-session-back]')).toBeNull();
    tab.unmount();

    go({ to: ARTIFACT_PLACE });
    renderWorkspace();
    await waitFor(() => expect(headOf().getAttribute('data-head-nav')).toBe('crumbs'));

    const row = headOf().querySelector('[data-slot="pane-title-row"]');
    const back = row?.querySelector<HTMLButtonElement>('[data-session-back]') ?? null;
    expect(back?.getAttribute('aria-label')).toBe('Back to Artifacts');
    expect(row?.querySelector('button')).toBe(back);
    expect(back?.closest('[data-session-crumbs]')).toBeNull();

    act(() => back?.click());

    const { place } = captureLocation({ state: useAppStore.getState() });
    expect(place.at === 'session' ? place.view : null).toMatchObject({
      lens: 'plans',
      target: null,
      agentId: null,
    });
    await waitFor(() => expect(headOf().getAttribute('data-head-nav')).toBe('tabs'));
    expect(document.querySelector('[data-session-back]')).toBeNull();
  });

  it.each([
    ['Artifacts', 1, 'plans'],
    ['the session title', 0, null],
  ] as const)('opens the place of %s when its crumb is pressed', async (_name, index, lens) => {
    go({ to: ARTIFACT_PLACE });
    renderWorkspace();
    await waitFor(() => expect(crumbLabels()).toHaveLength(3));

    const crumb = document.querySelector(`[data-crumb="${index}"]`);
    expect(crumb).not.toBeNull();
    if (crumb !== null) {
      fireEvent.click(crumb);
    }

    const { place } = captureLocation({ state: useAppStore.getState() });
    expect(place.at === 'session' ? place.view : null).toMatchObject({ lens, target: null });
    await waitFor(() => expect(headOf().getAttribute('data-head-nav')).toBe('tabs'));
  });

  it('goes one crumb up on Esc', async () => {
    go({ to: ARTIFACT_PLACE });
    renderWorkspace();
    await waitFor(() => expect(headOf().getAttribute('data-head-nav')).toBe('crumbs'));

    act(() => escapeLadder({}));

    const { place } = captureLocation({ state: useAppStore.getState() });
    expect(place.at === 'session' ? place.view : null).toMatchObject({
      lens: 'plans',
      target: null,
      agentId: null,
    });
    await waitFor(() => expect(headOf().getAttribute('data-head-nav')).toBe('tabs'));
  });
});
