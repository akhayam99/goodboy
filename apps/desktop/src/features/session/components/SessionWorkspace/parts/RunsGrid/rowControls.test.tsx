// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../../store/storyHarness')).dbModuleMock(),
);
vi.mock('../../../../../../shared/lib/db', async () =>
  (await import('../../../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { Agent, SessionMountView } from '@goodboy/types';
import { aProject, aSession } from '@goodboy/types/testing';
import { ToastProvider } from '../../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../../store/storyHarness';
import { aNowAgent, NOW_SESSION } from '../../../../central/now/testing/nowModelOf';
import { aMountView } from '../../../../testing/aMountView';
import { aProjectMountOf } from '../../../../testing/aProjectMountOf';
import { sessionRunsOf, type SessionRun } from '../../../../sessionRunsOf';
import { sessionPlace } from '../../../../../../store/slices/navigation/place';
import { backOf } from '../../../../../../store/slices/navigation/backOf';
import { captureLocation } from '../../../../../../store/slices/navigation/captureLocation';
import { openBranchWork } from '../../../../openBranchWork';
import { RENAME_REQUEST_EVENT } from '../../../../../../shared/utils/renameRequest';
import { ObjectMenuProvider } from '../../../../../actions/components/ObjectMenuProvider';
import { VISIBLE_FINISHED_COUNT } from '../../../../finishedRunsCap';
import { aSessionRun } from '../../../../testing/aSessionRun';
import { mountGithubOf } from '../../../../../workspace/testing/sessionColumn';
import { RunsGrid } from './index';

const session = aSession({ id: NOW_SESSION });
const PAYMENTS = aProject({ name: 'payments-api' });
const NOTIFY = aProject({ name: 'notify-relay' });
const DUP = aMountView({
  key: 'dup',
  sessionId: NOW_SESSION,
  projectId: PAYMENTS.id,
  projectName: 'payments-api',
  branch: 'fix/duplicate-credit',
});
const RETRY = aMountView({
  key: 'retry',
  sessionId: NOW_SESSION,
  projectId: NOTIFY.id,
  projectName: 'notify-relay',
  branch: 'feat/retry-budget',
});
const MOUNTS: ReadonlyArray<SessionMountView> = [DUP, RETRY];

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  localStorage.clear();
  await resetStoryStore();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  cleanup();
});

const runsOf = ({ agents }: { readonly agents: ReadonlyArray<Agent> }) =>
  sessionRunsOf({
    attachedRuns: [],
    agents,
    kindOverride: {},
    autoViews: [],
    orchestrating: {},
    questions: [],
    rootTurns: {},
    turnByAgentId: new Map(),
    revisingStarts: {},
    mounts: MOUNTS,
    projects: [],
  });

const onMount = (params: {
  readonly key: string;
  readonly name: string;
  readonly mount: SessionMountView;
}): Agent => ({
  ...aNowAgent({ key: params.key, name: params.name, status: 'running' }),
  mountId: params.mount.id,
});

const renderWorld = ({ agents }: { readonly agents: ReadonlyArray<Agent> }) => {
  useAppStore.setState({
    sessionPhaseRuns: { [NOW_SESSION]: agents },
    sessionMounts: { [NOW_SESSION]: [...MOUNTS] },
    sessionProjectMounts: { [NOW_SESSION]: MOUNTS.map((view) => aProjectMountOf({ view })) },
    projects: [PAYMENTS, NOTIFY],
  });
  return render(
    <ToastProvider>
      <ObjectMenuProvider>
        <RunsGrid session={session} runs={runsOf({ agents })} />
      </ObjectMenuProvider>
    </ToastProvider>,
  );
};

const twoBranchRun = (): ReadonlyArray<Agent> => {
  const lead = onMount({ key: 'lead', name: 'Move the backfill', mount: DUP });
  return [
    lead,
    {
      ...aNowAgent({ key: 'lead-child', name: 'Notify child', status: 'running' }),
      parentAgentId: lead.id,
      mountId: RETRY.id,
    },
    onMount({ key: 'limit', name: 'Limit retries', mount: RETRY }),
  ];
};

describe('run row controls', () => {
  it('opens the Branch page from the branch chip, and the chip is no child of the row', () => {
    const navigate = vi.fn();
    useAppStore.setState({ navigate });
    renderWorld({ agents: twoBranchRun() });
    fireEvent.click(screen.getByRole('tab', { name: 'By state' }));

    const chip = screen.getAllByRole('button', { name: 'Open branch fix/duplicate-credit' })[0];
    expect(chip?.closest('[data-list-grid-row]')).toBeNull();
    if (chip === undefined) {
      throw new Error('no chip');
    }
    fireEvent.click(chip);

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate.mock.calls[0]?.[0]).toMatchObject({
      to: { view: { target: { kind: 'branch', mountPath: DUP.worktreePath } } },
    });
  });

  it('hides Open branch for a branch the Branch page does not know, and keeps its chip as text', () => {
    renderWorld({ agents: twoBranchRun() });
    act(() =>
      useAppStore.setState({
        sessionProjectMounts: { [NOW_SESSION]: [aProjectMountOf({ view: DUP })] },
      }),
    );

    const groupOf = (name: string): HTMLElement => {
      const group = screen.getByRole('heading', { level: 2, name }).closest('li');
      if (group === null) {
        throw new Error(`no group ${name}`);
      }
      return group;
    };
    within(groupOf('fix/duplicate-credit')).getByRole('button', { name: 'Open branch' });
    expect(
      within(groupOf('feat/retry-budget')).queryByRole('button', { name: 'Open branch' }),
    ).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'By state' }));
    expect(screen.queryByRole('button', { name: `Open branch ${RETRY.branch}` })).toBeNull();
    screen.getAllByRole('button', { name: `Open branch ${DUP.branch}` });
  });

  it('reveals the same run in the other group from Also on and focuses it', () => {
    renderWorld({ agents: twoBranchRun() });

    const duplicate = screen.getByRole('list', { name: 'fix/duplicate-credit' });
    fireEvent.click(within(duplicate).getByTestId('run-also-on'));

    const retry = screen.getByRole('list', { name: 'feat/retry-budget' });
    const row = within(retry).getByRole('button', { name: /^Open Move the backfill/ });
    expect(document.activeElement).toBe(row);
  });

  it('opens the run immediately on one click of the title', () => {
    vi.useFakeTimers();
    const navigate = vi.fn();
    useAppStore.setState({ navigate });
    const { container } = renderWorld({
      agents: [onMount({ key: 'block', name: 'Block double credits', mount: DUP })],
    });

    const title = container.querySelector('[data-run-row-title]');
    if (title === null) {
      throw new Error('no title');
    }
    fireEvent.click(title);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('renames in place from the row menu and never opens the run', () => {
    vi.useFakeTimers();
    const navigate = vi.fn();
    const renameAgent = vi.fn(async () => undefined);
    useAppStore.setState({ navigate, renameAgent });
    renderWorld({
      agents: [onMount({ key: 'block', name: 'Block double credits', mount: DUP })],
    });

    fireEvent.contextMenu(screen.getByRole('button', { name: /^Open Block double credits/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));

    expect(navigate).not.toHaveBeenCalled();
    const input = screen.getByRole('textbox', { name: 'Rename run' });
    fireEvent.change(input, { target: { value: 'Stop double credits' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(renameAgent).toHaveBeenCalledTimes(1);
  });

  it('renames only the row the request names when a run stands in two groups', () => {
    const agents = twoBranchRun();
    renderWorld({ agents });
    const run = runsOf({ agents }).find((candidate: SessionRun) =>
      candidate.title.startsWith('Move'),
    );
    if (run === undefined || run.open.kind === 'run') {
      throw new Error('no run');
    }
    const { agentId } = run.open;
    const groupKey = `mount:${DUP.id}`;

    act(() => {
      window.dispatchEvent(
        new CustomEvent(RENAME_REQUEST_EVENT, {
          detail: { objectKey: `agent:${agentId}`, anchorKey: `run:${groupKey}/${run.id}` },
          cancelable: true,
        }),
      );
    });

    expect(screen.getAllByRole('textbox', { name: 'Rename run' })).toHaveLength(1);
  });
});

describe('from a branch to its runs', () => {
  it('opens the group, keeps the grouping, and Back returns to the branch', () => {
    const place = sessionPlace({ sessionId: NOW_SESSION });
    useAppStore.getState().navigate({ to: place });
    const finished: Agent = {
      ...aNowAgent({ key: 'old', name: 'Older pass', status: 'completed' }),
      mountId: DUP.id,
    };
    const groupKey = `mount:${DUP.id}`;

    openBranchWork({
      sessionId: NOW_SESSION,
      lens: 'workflows',
      groupKey,
      mountPath: DUP.worktreePath,
    });
    renderWorld({
      agents: [
        onMount({ key: 'block', name: 'Block double credits', mount: DUP }),
        onMount({ key: 'limit', name: 'Limit retries', mount: RETRY }),
        finished,
      ],
    });

    expect(useAppStore.getState().groupBySession[NOW_SESSION]).toBeUndefined();
    screen.getByRole('button', { name: /^Open Older pass/ });
    const state = useAppStore.getState();
    const here = captureLocation({ state }).place;
    expect(here.at === 'session' ? here.view.lens : null).toBe('workflows');
    expect(backOf({ state, place: here })?.label).toBe('Back to branch');
  });

  it('reveals and focuses a branch run past the state view cap with only one work branch', () => {
    useAppStore.getState().navigate({ to: sessionPlace({ sessionId: NOW_SESSION }) });
    const groupKey = `mount:${DUP.id}`;
    const branch = {
      mountId: DUP.id,
      projectId: PAYMENTS.id,
      projectName: 'payments-api',
      branch: DUP.branch,
      worktreePath: DUP.worktreePath,
    };
    const earlier = aSessionRun({ id: 'ledger-core', isFinished: true, branches: [branch] });
    const runs = [
      ...Array.from({ length: VISIBLE_FINISHED_COUNT }, (_, index) =>
        aSessionRun({ id: `notify-relay-${index}`, isFinished: true }),
      ),
      earlier,
      aSessionRun({ id: 'payments-api', isFinished: true, branches: [branch] }),
    ];
    const scrolled = vi.fn();
    vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(scrolled);
    render(
      <ToastProvider>
        <RunsGrid session={session} runs={runs} />
      </ToastProvider>,
    );
    expect(screen.queryByRole('button', { name: /^Open ledger-core/ })).toBeNull();

    act(() =>
      openBranchWork({
        sessionId: NOW_SESSION,
        lens: 'workflows',
        groupKey,
        mountPath: DUP.worktreePath,
      }),
    );

    expect(screen.queryByRole('tab', { name: 'By branch' })).toBeNull();
    const row = screen.getByRole('button', { name: /^Open ledger-core/ });
    screen.getByRole('button', { name: /^Open payments-api/ });
    expect(row.getAttribute('data-row-key')).toBe(earlier.id);
    expect(document.activeElement).toBe(row);
    expect(scrolled.mock.contexts).toContain(row);
  });

  it('opens Finished and focuses the run of a merged branch it arrives from', () => {
    useAppStore.getState().navigate({ to: sessionPlace({ sessionId: NOW_SESSION }) });
    const github = mountGithubOf({ mount: aProjectMountOf({ view: DUP }), number: 10198 });
    const done: Agent = {
      ...aNowAgent({ key: 'done', name: 'Older pass', status: 'completed' }),
      mountId: DUP.id,
    };
    const scrolled = vi.fn();
    vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(scrolled);
    renderWorld({ agents: [done, onMount({ key: 'limit', name: 'Limit retries', mount: RETRY })] });
    act(() =>
      useAppStore.setState({
        mountGithub: {
          [DUP.id]: {
            ...github,
            pr: github.pr === null ? null : { ...github.pr, state: 'merged' },
          },
        },
      }),
    );
    expect(screen.queryByRole('button', { name: /^Open Older pass/ })).toBeNull();

    act(() =>
      openBranchWork({
        sessionId: NOW_SESSION,
        lens: 'workflows',
        groupKey: `mount:${DUP.id}`,
        mountPath: DUP.worktreePath,
      }),
    );

    const row = screen.getByRole('button', { name: /^Open Older pass/ });
    expect(document.activeElement).toBe(row);
    expect(scrolled.mock.contexts).toContain(row);
  });

  it('goes Back to the row it left, not to the first row of the group', () => {
    const place = sessionPlace({ sessionId: NOW_SESSION });
    useAppStore.getState().navigate({ to: place });
    const agents = [
      ...['block', 'limit', 'retry', 'refund', 'audit'].map((key) =>
        onMount({ key, name: `Run ${key}`, mount: DUP }),
      ),
      onMount({ key: 'budget', name: 'Run budget', mount: RETRY }),
    ];
    const runs = runsOf({ agents });
    const groupKey = `mount:${DUP.id}`;
    const fifth = runs.find((run) => run.title === 'Run audit');
    if (fifth === undefined) {
      throw new Error('no run');
    }
    const rowKey = `${groupKey}/${fifth.id}`;
    openBranchWork({
      sessionId: NOW_SESSION,
      lens: 'workflows',
      groupKey,
      mountPath: DUP.worktreePath,
    });
    useAppStore.getState().amendFocus({
      patch: { scroll: { runs: runs.indexOf(fifth) }, returnRows: { runs: rowKey } },
    });
    const scrolled = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrolled;

    renderWorld({ agents });

    const row = document.querySelector<HTMLElement>(`[data-row-key="${CSS.escape(rowKey)}"]`);
    expect(row).not.toBeNull();
    expect(scrolled).toHaveBeenCalledOnce();
    expect(scrolled.mock.contexts[0]).toBe(row);
    expect(document.activeElement).not.toBe(
      document.querySelector(`[data-row-key="${CSS.escape(`${groupKey}/${runs[0]?.id ?? ''}`)}"]`),
    );
  });

  it('keeps the plain Back when the page was not reached from a branch', () => {
    useAppStore.getState().navigate({
      to: sessionPlace({ sessionId: NOW_SESSION, lens: 'workflows' }),
    });
    const state = useAppStore.getState();

    expect(backOf({ state, place: captureLocation({ state }).place })?.label).not.toBe(
      'Back to branch',
    );
  });
});
