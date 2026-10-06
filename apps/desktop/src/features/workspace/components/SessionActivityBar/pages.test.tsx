// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { aWorkflowRun, anAgent } from '@goodboy/types/testing';
import type { Session, SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { lensDestinations } from '../../../session/lens-destinations';
import { sessionTitle } from '../../../session/sessionTitle';
import { usePageSummaries } from '../../../session/hooks/usePageSummaries';
import { pageMenu } from '../../../session/trail/menus/pageMenu';
import {
  harborline,
  renderBar,
  seedColumn,
  sessionOf,
} from '../../../../__tests__/helpers/sessionColumn';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
});

afterEach(cleanup);

const PAGE_LABELS = ['Overview', 'Branch', 'Runs', 'Agents', 'Artifacts'];

const open = sessionOf({ goal: 'Fix webhook retries', lastOpenedAt: '2026-10-06T09:00:00.000Z' });
const other = sessionOf({
  goal: 'Ledger export speedup',
  lastOpenedAt: '2026-10-05T09:00:00.000Z',
});

const mountOpen = (session: Session = open) => {
  seedColumn({
    store: useAppStore,
    sessions: [session, other],
    currentSessionId: session.id as SessionId,
  });
  useAppStore.setState({ sessionBranches: { [session.id]: 'goodboy/webhook-retries' } });
  return renderBar();
};

const pagesOf = () => within(screen.getByRole('list', { name: 'Pages' }));

const PAGE_LABEL_OF: Readonly<Record<string, string>> = {
  overview: 'Overview',
  branch: 'Branch',
  runs: 'Runs',
  agents: 'Agents',
  artifacts: 'Artifacts',
};

const nestedCount = (pageId: string): string | null => {
  const text =
    screen
      .getAllByRole('button')
      .find((candidate) => candidate.getAttribute('data-page-id') === pageId)?.textContent ?? '';
  const count = text.slice((PAGE_LABEL_OF[pageId] ?? '').length);
  return count === '' ? null : count;
};

type MenuProbeProps = {
  readonly session: Session;
};

const MenuProbe = ({ session }: MenuProbeProps) => {
  const summaries = usePageSummaries({ session });
  const model = pageMenu({
    destinations: lensDestinations({
      isBranchless: false,
      connectedTools: { linear: false, gitlab: false, jira: false, slack: false },
    }),
    activeLens: null,
    isBranchless: false,
    sessionTitle: sessionTitle({ session }),
    summaries,
    actions: [],
    onSelect: () => undefined,
  });
  return (
    <ul aria-label="Page menu">
      {model.groups
        .flatMap((group) => group.rows)
        .map((row) => (
          <li key={row.id} data-lens={row.id}>
            {row.metaA}
          </li>
        ))}
    </ul>
  );
};

const menuCount = (lens: string): string | null => {
  const text =
    within(screen.getByRole('list', { name: 'Page menu' }))
      .getAllByRole('listitem')
      .find((item) => item.getAttribute('data-lens') === lens)?.textContent ?? '';
  return text === '' ? null : text;
};

describe('the pages under the open session', () => {
  it('nests the five work pages under its row, in order', () => {
    mountOpen();
    const pages = pagesOf().getAllByRole('button');
    expect(pages.map((page) => page.textContent)).toEqual(PAGE_LABELS);
  });

  it('shows pages for the open session only', () => {
    mountOpen();
    expect(screen.getAllByRole('list', { name: 'Pages' })).toHaveLength(1);
  });

  it('shows none on the board, where no session is open', () => {
    seedColumn({ store: useAppStore, sessions: [open, other], currentSessionId: null });
    renderBar();
    expect(screen.queryByRole('list', { name: 'Pages' })).toBeNull();
  });

  it('keeps all five rows when a session has nothing to count', () => {
    mountOpen();
    expect(pagesOf().getAllByRole('button')).toHaveLength(5);
    expect(nestedCount('runs')).toBeNull();
  });

  it('reads a branchless session as File versions in place of Branch', () => {
    seedColumn({ store: useAppStore, sessions: [open], currentSessionId: open.id as SessionId });
    useAppStore.setState({ sessionBranches: { [open.id]: '' } });
    renderBar();
    expect(pagesOf().getByRole('button', { name: /^File versions/ })).toBeDefined();
    expect(pagesOf().queryByRole('button', { name: /^Branch/ })).toBeNull();
  });

  it('marks the page that is open and moves with it', () => {
    mountOpen();
    expect(
      pagesOf()
        .getByRole('button', { name: /^Overview/ })
        .getAttribute('aria-current'),
    ).toBe('page');
    act(() => {
      useAppStore.setState({ activeLens: { [open.id]: 'agents' } });
    });
    expect(
      pagesOf()
        .getByRole('button', { name: /^Agents/ })
        .getAttribute('aria-current'),
    ).toBe('page');
    expect(
      pagesOf()
        .getByRole('button', { name: /^Overview/ })
        .getAttribute('aria-current'),
    ).toBeNull();
  });

  it('opens a page from its row', () => {
    mountOpen();
    fireEvent.click(pagesOf().getByRole('button', { name: /^Agents/ }));
    expect(useAppStore.getState().activeLens[open.id]).toBe('agents');
  });

  it('opens the Branch page on Comments from its row', () => {
    mountOpen();
    fireEvent.click(pagesOf().getByRole('button', { name: /^Branch/ }));
    expect(useAppStore.getState().activeLens[open.id]).toBe('branch');
    expect(useAppStore.getState().branchTab[open.id]).toBe('comments');
  });

  it('folds with Left on the open row and opens again with Right', () => {
    mountOpen();
    const row = screen.getByRole('button', { name: 'Fix webhook retries' });
    fireEvent.keyDown(row, { key: 'ArrowLeft' });
    expect(screen.queryByRole('list', { name: 'Pages' })).toBeNull();
    fireEvent.keyDown(row, { key: 'ArrowRight' });
    expect(screen.getByRole('list', { name: 'Pages' })).toBeDefined();
  });

  it('folds the pages away when another session opens', () => {
    mountOpen();
    act(() => {
      useAppStore.setState({ currentSessionId: other.id });
    });
    expect(
      within(
        screen.getByRole('button', { name: 'Ledger export speedup' }).closest('li') as HTMLElement,
      ).getByRole('list', { name: 'Pages' }),
    ).toBeDefined();
    expect(
      within(
        screen.getByRole('button', { name: 'Fix webhook retries' }).closest('li') as HTMLElement,
      ).queryByRole('list', { name: 'Pages' }),
    ).toBeNull();
  });
});

describe('counts on the pages and in the page menu', () => {
  const busy = sessionOf({
    goal: 'Fix webhook retries',
    lastOpenedAt: '2026-10-06T09:00:00.000Z',
  });
  const withRuns: Session = {
    ...busy,
    workflowRuns: [aWorkflowRun({ ordinal: 0 }), aWorkflowRun({ ordinal: 1 })],
  };

  const mountBoth = () => {
    seedColumn({
      store: useAppStore,
      sessions: [withRuns, other],
      currentSessionId: withRuns.id as SessionId,
    });
    useAppStore.setState({
      sessionBranches: { [withRuns.id]: 'goodboy/webhook-retries' },
      sessionPhaseRuns: {
        [withRuns.id]: [
          anAgent({ sessionId: withRuns.id as SessionId, status: 'running', name: 'Implementer' }),
          anAgent({
            sessionId: withRuns.id as SessionId,
            status: 'completed',
            ordinal: 1,
            name: 'Planner',
          }),
        ],
      },
    });
    return render(
      <>
        <MenuProbe session={withRuns} />
      </>,
    );
  };

  it.each([
    ['runs', 'workflows'],
    ['agents', 'agents'],
    ['artifacts', 'plans'],
    ['branch', 'review'],
  ])('shows on the %s page the same count as the %s row of the page menu', (pageId, lens) => {
    mountBoth();
    renderBar();
    expect(nestedCount(pageId)).toBe(menuCount(lens));
  });

  it('counts the runs and the running agents in words', () => {
    mountBoth();
    renderBar();
    expect(nestedCount('runs')).toBe('2 runs');
    expect(nestedCount('agents')).toBe('1 running');
  });
});
