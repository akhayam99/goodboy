// @vitest-environment happy-dom

const h = vi.hoisted(() => {
  const gate: { current: Promise<void> | null } = { current: null };
  return {
    invoke: vi.fn<(command: string, args?: Record<string, unknown>) => Promise<unknown>>(),
    lists: new Map<string, unknown>(),
    reads: new Array<unknown>(),
    openFailures: new Array<unknown>(),
    gate,
  };
});

vi.mock('@tauri-apps/api/core', () => ({ invoke: h.invoke }));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => undefined),
  emit: vi.fn(async () => undefined),
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import { aProject, anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../store/storyHarness';
import type { StoryStore } from '../../../../store/storyHarness';
import {
  SESSION,
  mountFixture,
  sessionFixture,
} from '../../../../__tests__/helpers/actionFixtures';
import { ToastProvider } from '../../../../shared/components/Toast';
import { ObjectMenuProvider } from '../../../actions/components/ObjectMenuProvider';
import { selectOpenDrawer } from '../../../../store/slices/drawer/selectOpenDrawer';
import { CommandError } from '../../../../shared/lib/invokeCommand';
import { ExploreFileDrawer } from '../ExploreFileDrawer';
import { EXPLORE_ROW_PX } from '../../exploreRows';
import { ExplorePane } from '.';

let useAppStore: StoryStore;

type AppState = ReturnType<StoryStore['getState']>;

const SESSION_ID: SessionId = SESSION;
const DIR = '/workspace/sessions/session-1';
const OTHER_DIR = '/workspace/sessions/session-2';
const HOURS_AGO = 14;

const modifiedAt = (): string => new Date(Date.now() - HOURS_AGO * 3_600_000).toISOString();

type EntryParams = {
  readonly relPath: string;
  readonly isDir?: boolean;
  readonly sizeBytes?: number;
};

const entry = ({ relPath, isDir = false, sizeBytes = 20 }: EntryParams) => ({
  name: relPath.slice(relPath.lastIndexOf('/') + 1),
  relPath,
  isDir,
  sizeBytes: isDir ? 0 : sizeBytes,
  modifiedAt: modifiedAt(),
});

const folder = (relPath: string) => entry({ relPath, isDir: true });

const list = ({ relPath, entries }: { relPath: string; entries: ReadonlyArray<unknown> }) => {
  h.lists.set(`${DIR}\n${relPath}`, entries);
};

const failList = ({ relPath, message }: { relPath: string; message: string }) => {
  h.lists.set(`${DIR}\n${relPath}`, new Error(message));
};

const callsTo = (command: string) => h.invoke.mock.calls.filter(([name]) => name === command);

const PaneWithDrawer = ({ sessionDir = DIR }: { readonly sessionDir?: string }) => {
  const drawer = useAppStore((state) => selectOpenDrawer(state));
  const closeDrawer = useAppStore((state) => state.closeDrawer);
  return (
    <>
      <ExplorePane sessionId={SESSION_ID} sessionDir={sessionDir} />
      {drawer !== null && drawer.kind === 'explore-file' ? (
        <ExploreFileDrawer
          sessionId={SESSION_ID}
          sessionDir={drawer.payload.sessionDir}
          entry={drawer.payload.entry}
          onClose={closeDrawer}
        />
      ) : null}
    </>
  );
};

const Shell = ({ sessionDir }: { readonly sessionDir?: string }) => (
  <ToastProvider>
    <ObjectMenuProvider>
      <PaneWithDrawer {...(sessionDir === undefined ? {} : { sessionDir })} />
    </ObjectMenuProvider>
  </ToastProvider>
);

const mount = () => render(<Shell />);

const rowNamed = async (name: string) => screen.findByRole('treeitem', { name });

const mountRepo = () => {
  const project = aProject({ id: mountFixture().projectId, kind: 'repo' });
  useAppStore.setState({
    projects: [project],
    sessionProjectMounts: {
      [SESSION_ID]: [mountFixture({ worktreePath: DIR, branch: 'ak/fix-retry' })],
    },
    sessionActiveMount: { [SESSION_ID]: mountFixture().mountId },
    detectedEditors: [{ binary: 'code', label: 'VS Code' }],
  });
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  h.lists.clear();
  h.reads.length = 0;
  h.openFailures.length = 0;
  h.gate.current = null;
  h.invoke.mockReset();
  h.invoke.mockImplementation(async (command, args = {}) => {
    if (command === 'explore_list') {
      const key = `${String(args['sessionDir'])}\n${String(args['relPath'])}`;
      if (h.gate.current !== null && args['sessionDir'] === DIR) {
        await h.gate.current;
      }
      const found = h.lists.get(key);
      if (found instanceof Error) {
        throw found;
      }
      return found ?? [];
    }
    if (command === 'explore_read') {
      return h.reads.shift();
    }
    if (command === 'explore_open') {
      const failure = h.openFailures.shift();
      if (failure !== undefined) {
        throw failure;
      }
      return undefined;
    }
    if (command === 'detect_editors') {
      return [];
    }
    return undefined;
  });
  useAppStore.setState({
    sessions: [sessionFixture()],
    currentSessionId: SESSION_ID,
    providers: useAppStore
      .getState()
      .providers.map((provider) =>
        provider.id === 'anthropic' ? { ...provider, connection: 'connected' } : provider,
      ),
  });
});

afterEach(cleanup);

describe('ExplorePane tree', () => {
  it('lists the root as a tree and opens a folder when you click it', async () => {
    list({ relPath: '', entries: [folder('docs'), entry({ relPath: 'notes.txt' })] });
    list({ relPath: 'docs', entries: [entry({ relPath: 'docs/README.md', sizeBytes: 10 })] });
    mount();

    const docs = await rowNamed('docs');
    expect(screen.getByRole('tree', { name: 'Files' })).toBeDefined();
    expect(docs.getAttribute('aria-level')).toBe('1');
    expect(docs.getAttribute('aria-expanded')).toBe('false');
    expect(await rowNamed('notes.txt')).toBeDefined();
    expect(callsTo('explore_list')).toEqual([['explore_list', { sessionDir: DIR, relPath: '' }]]);

    fireEvent.click(docs);

    const readme = await rowNamed('README.md');
    expect(readme.getAttribute('aria-level')).toBe('2');
    expect(docs.getAttribute('aria-expanded')).toBe('true');
    expect(callsTo('explore_list')).toContainEqual([
      'explore_list',
      { sessionDir: DIR, relPath: 'docs' },
    ]);
  });

  it('puts the size and the age on a file row and leaves them off a folder', async () => {
    list({
      relPath: '',
      entries: [folder('docs'), entry({ relPath: 'brief.md', sizeBytes: 5222 })],
    });
    mount();

    const file = await rowNamed('brief.md');
    expect(within(file).getByText('5.1 KB')).toBeDefined();
    expect(within(file).getByText(`${HOURS_AGO}h ago`)).toBeDefined();
    const docs = await rowNamed('docs');
    expect(within(docs).queryByText(/KB|\bB\b/)).toBeNull();
    expect(within(docs).getByText(`${HOURS_AGO}h ago`)).toBeDefined();
  });

  it('makes every row the height of the Explore row constant', () => {
    expect(EXPLORE_ROW_PX).toBe(40);
  });

  it('shows a loading row, then the folder, and says an empty folder is empty', async () => {
    list({ relPath: '', entries: [folder('exports')] });
    list({ relPath: 'exports', entries: [] });
    mount();

    fireEvent.click(await rowNamed('exports'));

    expect(await screen.findByText('This folder is empty')).toBeDefined();
  });

  it('says the folder is empty when the root has nothing', async () => {
    list({ relPath: '', entries: [] });
    mount();

    expect(await screen.findByText('This folder is empty')).toBeDefined();
    expect(screen.queryByRole('tree')).toBeNull();
  });

  it('shows listing errors instead of the empty state and retries on request', async () => {
    failList({ relPath: '', message: 'io error: permission denied' });
    mount();

    expect(await screen.findByText("Couldn't read this session folder")).toBeDefined();
    expect(screen.getByText('io error: permission denied')).toBeDefined();
    expect(screen.queryByText('This folder is empty')).toBeNull();

    list({ relPath: '', entries: [entry({ relPath: 'notes.txt' })] });
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await rowNamed('notes.txt')).toBeDefined();
  });

  it('shows the error under a folder that could not be read and retries only that folder', async () => {
    list({ relPath: '', entries: [folder('docs'), entry({ relPath: 'notes.txt' })] });
    failList({ relPath: 'docs', message: 'io error: permission denied' });
    mount();

    fireEvent.click(await rowNamed('docs'));

    expect(await screen.findByText("Couldn't read this folder")).toBeDefined();
    expect(screen.getByText('io error: permission denied')).toBeDefined();
    expect(await rowNamed('notes.txt')).toBeDefined();

    list({ relPath: 'docs', entries: [entry({ relPath: 'docs/README.md' })] });
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await rowNamed('README.md')).toBeDefined();
    expect(callsTo('explore_list').filter(([, args]) => args?.['relPath'] === '')).toHaveLength(1);
  });

  it('drops a late answer for the folder you already left', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    h.gate.current = gate;
    list({ relPath: '', entries: [entry({ relPath: 'old.txt' })] });
    h.lists.set(`${OTHER_DIR}\n`, [entry({ relPath: 'fresh.txt' })]);

    const view = render(<Shell />);
    view.rerender(<Shell sessionDir={OTHER_DIR} />);

    expect(await rowNamed('fresh.txt')).toBeDefined();
    await act(async () => {
      release();
      await gate;
    });

    expect(screen.queryByRole('treeitem', { name: 'old.txt' })).toBeNull();
    expect(screen.getByRole('treeitem', { name: 'fresh.txt' })).toBeDefined();
  });

  it('remembers the open folders when you come back to Explore', async () => {
    list({ relPath: '', entries: [folder('docs'), folder('apps')] });
    list({ relPath: 'docs', entries: [entry({ relPath: 'docs/README.md' })] });
    const first = mount();

    fireEvent.click(await rowNamed('docs'));
    await rowNamed('README.md');
    expect(useAppStore.getState().exploreExpanded[SESSION_ID]).toEqual({ docs: true });
    first.unmount();

    mount();

    expect(await rowNamed('README.md')).toBeDefined();
    expect((await rowNamed('docs')).getAttribute('aria-expanded')).toBe('true');
    expect((await rowNamed('apps')).getAttribute('aria-expanded')).toBe('false');
  });

  it('opens the folders above a file that was opened from elsewhere', async () => {
    list({ relPath: '', entries: [folder('apps'), entry({ relPath: 'package.json' })] });
    list({ relPath: 'apps', entries: [folder('apps/ledger-core')] });
    list({
      relPath: 'apps/ledger-core',
      entries: [entry({ relPath: 'apps/ledger-core/rounding.ts' })],
    });
    h.reads.push({ type: 'text', text: 'export {}', truncated: false });
    useAppStore.getState().openDrawer({
      kind: 'explore-file',
      sessionId: SESSION_ID,
      payload: { sessionDir: DIR, entry: entry({ relPath: 'apps/ledger-core/rounding.ts' }) },
    });
    mount();

    const file = await rowNamed('rounding.ts');

    expect(file.getAttribute('aria-level')).toBe('3');
    expect(file.getAttribute('aria-selected')).toBe('true');
    expect(useAppStore.getState().exploreExpanded[SESSION_ID]).toEqual({
      apps: true,
      'apps/ledger-core': true,
    });
  });

  it('lets you close the folder of the open file and keeps it closed', async () => {
    list({ relPath: '', entries: [folder('docs')] });
    list({ relPath: 'docs', entries: [entry({ relPath: 'docs/README.md' })] });
    h.reads.push({ type: 'text', text: '# Read me', truncated: false });
    mount();
    const docs = await rowNamed('docs');
    fireEvent.click(docs);
    fireEvent.click(await rowNamed('README.md'));
    await screen.findByRole('heading', { name: 'Read me' });

    fireEvent.click(docs);

    await waitFor(() => expect(screen.queryByRole('treeitem', { name: 'README.md' })).toBeNull());
    expect(docs.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes a folder and forgets it', async () => {
    list({ relPath: '', entries: [folder('docs')] });
    list({ relPath: 'docs', entries: [entry({ relPath: 'docs/README.md' })] });
    mount();

    const docs = await rowNamed('docs');
    fireEvent.click(docs);
    await rowNamed('README.md');
    fireEvent.click(docs);

    await waitFor(() => expect(screen.queryByRole('treeitem', { name: 'README.md' })).toBeNull());
    expect(useAppStore.getState().exploreExpanded[SESSION_ID]).toEqual({});
  });
});

describe('ExplorePane keys', () => {
  const seed = () => {
    list({
      relPath: '',
      entries: [folder('apps'), folder('docs'), entry({ relPath: 'package.json' })],
    });
    list({ relPath: 'apps', entries: [entry({ relPath: 'apps/readme.md' })] });
  };

  const press = (row: HTMLElement, key: string) => fireEvent.keyDown(row, { key });

  const focusedName = () => document.activeElement?.getAttribute('aria-label');

  const focusedRow = (): HTMLElement => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) {
      throw new Error('No row has the focus');
    }
    return active;
  };

  it('keeps one tab stop on the tree', async () => {
    seed();
    mount();
    await rowNamed('apps');

    const stops = screen.getAllByRole('treeitem').filter((row) => row.tabIndex === 0);
    expect(stops.map((row) => row.getAttribute('aria-label'))).toEqual(['apps']);
  });

  it('walks down and up with the arrows, and to the ends with Home and End', async () => {
    seed();
    mount();
    const apps = await rowNamed('apps');
    apps.focus();

    press(apps, 'ArrowDown');
    await waitFor(() => expect(focusedName()).toBe('docs'));
    press(focusedRow(), 'ArrowDown');
    await waitFor(() => expect(focusedName()).toBe('package.json'));
    press(focusedRow(), 'ArrowUp');
    await waitFor(() => expect(focusedName()).toBe('docs'));
    press(focusedRow(), 'End');
    await waitFor(() => expect(focusedName()).toBe('package.json'));
    press(focusedRow(), 'Home');
    await waitFor(() => expect(focusedName()).toBe('apps'));
  });

  it('opens a folder with Right, enters it with Right, and goes back with Left', async () => {
    seed();
    mount();
    const apps = await rowNamed('apps');
    apps.focus();

    press(apps, 'ArrowRight');
    const readme = await rowNamed('readme.md');
    expect(apps.getAttribute('aria-expanded')).toBe('true');

    press(apps, 'ArrowRight');
    await waitFor(() => expect(focusedName()).toBe('readme.md'));

    press(readme, 'ArrowLeft');
    await waitFor(() => expect(focusedName()).toBe('apps'));

    press(apps, 'ArrowLeft');
    await waitFor(() => expect(apps.getAttribute('aria-expanded')).toBe('false'));
    expect(screen.queryByRole('treeitem', { name: 'readme.md' })).toBeNull();
  });

  it('opens the preview of a file with Enter and with Space', async () => {
    seed();
    h.reads.push({ type: 'text', text: '{"name":"ledger-core"}', truncated: false });
    mount();
    const file = await rowNamed('package.json');
    file.focus();

    press(file, 'Enter');

    expect(await screen.findByText(/ledger-core/)).toBeDefined();
    await waitFor(() => expect(file.getAttribute('aria-selected')).toBe('true'));

    h.reads.push({ type: 'text', text: 'again', truncated: false });
    act(() => useAppStore.getState().closeDrawer());
    press(file, ' ');
    await waitFor(() => expect(file.getAttribute('aria-selected')).toBe('true'));
  });

  it('toggles a folder with Enter', async () => {
    seed();
    mount();
    const apps = await rowNamed('apps');
    apps.focus();

    press(apps, 'Enter');

    expect(await rowNamed('readme.md')).toBeDefined();
  });

  it('ignores a key typed on a button inside the row', async () => {
    seed();
    mount();
    const file = await rowNamed('package.json');
    const reveal = within(file).getByRole('button', { name: 'Show package.json in Finder' });

    fireEvent.keyDown(reveal, { key: 'ArrowDown' });

    expect(focusedName()).not.toBe('docs');
  });
});

describe('ExplorePane previews', () => {
  const listFiles = (...relPaths: ReadonlyArray<string>) =>
    list({ relPath: '', entries: relPaths.map((relPath) => entry({ relPath, sizeBytes: 1200 })) });

  it('renders markdown as markdown, text as text, and offers external open for unsupported files', async () => {
    listFiles('README.md', 'notes.log', 'budget.xlsx');
    h.reads.push({ type: 'text', text: '# Read me\n\nMarkdown body', truncated: false });
    h.reads.push({ type: 'text', text: 'line one\nline two', truncated: false });
    mount();

    fireEvent.click(await rowNamed('README.md'));
    expect(await screen.findByRole('heading', { name: 'Read me' })).toBeDefined();

    fireEvent.click(await rowNamed('notes.log'));
    expect(await screen.findByText(/line one/)).toBeDefined();
    expect(screen.getByText(/line two/)).toBeDefined();

    fireEvent.click(await rowNamed('budget.xlsx'));
    expect(
      await screen.findByText('This file is binary. Open it in the app that owns it.'),
    ).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    await waitFor(() =>
      expect(callsTo('explore_open')).toContainEqual([
        'explore_open',
        { sessionDir: DIR, relPath: 'budget.xlsx', reveal: false, editor: null },
      ]),
    );
  });

  it('holds the actions in the drawer header and none in the body', async () => {
    listFiles('page.tsx');
    h.reads.push({
      type: 'text',
      text: 'export const a = 1;\nexport const b = 2;',
      truncated: false,
    });
    mount();

    fireEvent.click(await rowNamed('page.tsx'));
    const drawer = await screen.findByRole('region', { name: 'page.tsx' });
    await screen.findByText(/export const b/);

    const header = drawer.querySelector('header');
    if (header === null) {
      throw new Error('missing drawer header');
    }
    const inHeader = within(header);
    expect(inHeader.getByRole('button', { name: 'Open' })).toBeDefined();
    expect(inHeader.getByRole('button', { name: 'Copy path' })).toBeDefined();
    expect(inHeader.getByRole('button', { name: 'Wrap lines' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    expect(inHeader.getByRole('button', { name: 'Close' })).toBeDefined();
    const body = within(drawer)
      .queryAllByRole('button')
      .filter((button) => !header.contains(button));
    expect(body).toEqual([]);
    expect(drawer.querySelectorAll('hr, [role="separator"]').length).toBe(1);
  });

  it('toggles wrap for code and remembers the choice', async () => {
    listFiles('page.tsx');
    h.reads.push({ type: 'text', text: 'export const a = 1;', truncated: false });
    mount();

    fireEvent.click(await rowNamed('page.tsx'));
    fireEvent.click(await screen.findByRole('button', { name: 'Wrap lines' }));

    expect(screen.getByRole('button', { name: 'Wrap lines' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(localStorage.getItem('goodboy:explore-wrap:v1')).toBe('true');
  });

  it('offers Preview and Source for markdown and no wrap button on prose', async () => {
    listFiles('README.md');
    h.reads.push({ type: 'text', text: '# Read me\n\nBody', truncated: false });
    mount();

    fireEvent.click(await rowNamed('README.md'));
    expect(await screen.findByRole('heading', { name: 'Read me' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Wrap lines' })).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Source' }));

    expect(screen.queryByRole('heading', { name: 'Read me' })).toBeNull();
    expect(screen.getByText('# Read me')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Wrap lines' })).toBeNull();
  });

  it('says a binary file is binary and keeps the open button in the header', async () => {
    listFiles('blob.dat');
    h.reads.push({ type: 'binary', size: 4096 });
    mount();

    fireEvent.click(await rowNamed('blob.dat'));

    expect(
      await screen.findByText('This file is binary. Open it in the app that owns it.'),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Wrap lines' })).toBeNull();
  });

  it('labels truncated text previews', async () => {
    listFiles('large.txt');
    h.reads.push({ type: 'text', text: 'trimmed', truncated: true });
    mount();

    fireEvent.click(await rowNamed('large.txt'));

    expect(await screen.findByText('Preview is truncated to 256 KB.')).toBeDefined();
  });
});

describe('ExplorePane row actions', () => {
  const listOne = (relPath: string) => list({ relPath: '', entries: [entry({ relPath })] });

  it('keeps the actions on every row, focusable and working', async () => {
    listOne('notes.txt');
    mount();
    const row = await rowNamed('notes.txt');
    const reveal = within(row).getByRole('button', { name: 'Show notes.txt in Finder' });

    reveal.focus();
    expect(document.activeElement).toBe(reveal);
    fireEvent.click(reveal);

    await waitFor(() =>
      expect(callsTo('explore_open')).toContainEqual([
        'explore_open',
        { sessionDir: DIR, relPath: 'notes.txt', reveal: true, editor: null },
      ]),
    );
  });

  it('does not open the preview when you press an action', async () => {
    listOne('notes.txt');
    mount();
    const row = await rowNamed('notes.txt');

    fireEvent.click(within(row).getByRole('button', { name: 'Show notes.txt in Finder' }));

    expect(selectOpenDrawer(useAppStore.getState())).toBeNull();
  });

  it('names each row action on hover, one tooltip at a time', async () => {
    listOne('notes.txt');
    mount();
    const row = await rowNamed('notes.txt');

    const expected = [
      { name: 'Ask an agent about notes.txt', tip: 'Ask an agent' },
      { name: 'Open notes.txt', tip: 'Open' },
      { name: 'Show notes.txt in Finder', tip: 'Show in Finder' },
    ];
    for (const { name, tip } of expected) {
      const button = within(row).getByRole('button', { name });
      fireEvent.mouseEnter(button);
      expect((await screen.findByRole('tooltip')).textContent).toBe(tip);
      fireEvent.mouseLeave(button);
      expect(screen.queryByRole('tooltip')).toBeNull();
    }
  });

  it('gives the row no native title', async () => {
    listOne('notes.txt');
    const { container } = mount();
    await rowNamed('notes.txt');

    expect(container.querySelectorAll('[title]')).toHaveLength(0);
  });

  it('mounts the ask popover only for the row you asked about', async () => {
    list({ relPath: '', entries: [entry({ relPath: 'a.txt' }), entry({ relPath: 'b.txt' })] });
    mount();
    await rowNamed('a.txt');
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Ask an agent about b.txt' }));

    const dialog = await screen.findByRole('dialog', { name: 'Ask an agent about b.txt' });
    expect(dialog).toBeDefined();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });

  it('shows no tooltip over the ask button while its popover is open', async () => {
    listOne('notes.txt');
    mount();
    await rowNamed('notes.txt');
    const ask = screen.getByRole('button', { name: 'Ask an agent about notes.txt' });

    fireEvent.click(ask);
    const open = await screen.findByRole('button', { name: 'Ask an agent about notes.txt' });
    fireEvent.mouseEnter(open);
    await new Promise((resolve) => setTimeout(resolve, 600));

    expect(screen.getByRole('dialog', { name: 'Ask an agent about notes.txt' })).toBeDefined();
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('puts the ask button back when its popover closes', async () => {
    listOne('notes.txt');
    mount();
    await rowNamed('notes.txt');

    fireEvent.click(screen.getByRole('button', { name: 'Ask an agent about notes.txt' }));
    await screen.findByRole('dialog', { name: 'Ask an agent about notes.txt' });
    fireEvent.mouseDown(document.body);

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('button', { name: 'Ask an agent about notes.txt' })).toBeDefined();
  });

  it('spawns from a file with the selected model and a prompt that includes ask and path', async () => {
    const agentId = anAgent().id;
    const spawnAgent = vi.fn<AppState['spawnAgent']>(async () => agentId);
    const navigate = vi.fn();
    useAppStore.setState({ spawnAgent, navigate });
    listOne('budget.xlsx');
    mount();
    await rowNamed('budget.xlsx');

    fireEvent.click(screen.getByRole('button', { name: 'Ask an agent about budget.xlsx' }));
    fireEvent.change(
      await screen.findByRole('textbox', { name: 'What should the agent do with this file?' }),
      { target: { value: 'Analyze this spreadsheet and summarize trends.' } },
    );
    fireEvent.click(screen.getByRole('button', { name: /^Agent routing:/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Opus' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start agent' }));

    await waitFor(() => expect(spawnAgent).toHaveBeenCalled());
    const args = spawnAgent.mock.calls.at(-1)?.[1];
    expect(args?.focus).toBe('none');
    expect(args?.model).toBe('claude-opus-5-5');
    expect(args?.initialPrompt).toContain('Analyze this spreadsheet and summarize trends.');
    expect(args?.initialPrompt).toContain('- budget.xlsx');
    expect(
      (args?.initialPrompt?.indexOf('Analyze this spreadsheet and summarize trends.') ?? 0) <
        (args?.initialPrompt?.indexOf('- budget.xlsx') ?? 0),
    ).toBe(true);
    expect(navigate).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByRole('button', { name: 'Follow' }));
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: { at: 'agent', sessionId: SESSION_ID, agentId },
      }),
    );
  });

  it('keeps spawn disabled when the ask is empty', async () => {
    listOne('notes.txt');
    mount();
    await rowNamed('notes.txt');

    fireEvent.click(screen.getByRole('button', { name: 'Ask an agent about notes.txt' }));

    expect(
      (await screen.findByRole('button', { name: 'Start agent' })).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('loads the detected editors when none are known yet', async () => {
    listOne('notes.txt');
    mount();
    await rowNamed('notes.txt');

    await waitFor(() => expect(callsTo('detect_editors')).toHaveLength(1));
  });

  it('offers no Ask on a folder row', async () => {
    list({ relPath: '', entries: [folder('docs')] });
    mount();
    const row = await rowNamed('docs');

    expect(within(row).queryByRole('button', { name: /Ask an agent/ })).toBeNull();
    expect(within(row).getByRole('button', { name: 'Show docs in Finder' })).toBeDefined();
  });
});

describe('ExplorePane in a repository with an editor', () => {
  const listPage = (name: string) => list({ relPath: '', entries: [entry({ relPath: name })] });

  it('offers Open in editor for code and opens it in that editor', async () => {
    mountRepo();
    listPage('page.tsx');
    mount();
    await rowNamed('page.tsx');

    const open = screen.getByRole('button', { name: 'Open page.tsx in VS Code' });
    fireEvent.mouseEnter(open);
    expect((await screen.findByRole('tooltip')).textContent).toBe('Open in editor');
    fireEvent.click(open);

    await waitFor(() =>
      expect(callsTo('explore_open')).toContainEqual([
        'explore_open',
        { sessionDir: DIR, relPath: 'page.tsx', reveal: false, editor: 'code' },
      ]),
    );
  });

  it('labels the drawer button the same way and names the editor on hover', async () => {
    mountRepo();
    listPage('page.tsx');
    h.reads.push({ type: 'text', text: 'export {}', truncated: false });
    mount();

    fireEvent.click(await rowNamed('page.tsx'));
    const open = await screen.findByRole('button', { name: 'Open in editor' });
    fireEvent.mouseEnter(open);
    expect((await screen.findByText('Open in VS Code')).getAttribute('role')).toBe('tooltip');
    fireEvent.click(open);

    await waitFor(() =>
      expect(callsTo('explore_open')).toContainEqual([
        'explore_open',
        { sessionDir: DIR, relPath: 'page.tsx', reveal: false, editor: 'code' },
      ]),
    );
  });

  it('keeps the default app for a PDF in a repository', async () => {
    mountRepo();
    listPage('spec.pdf');
    mount();
    await rowNamed('spec.pdf');

    fireEvent.click(screen.getByRole('button', { name: 'Open spec.pdf' }));

    await waitFor(() =>
      expect(callsTo('explore_open')).toContainEqual([
        'explore_open',
        { sessionDir: DIR, relPath: 'spec.pdf', reveal: false, editor: null },
      ]),
    );
  });

  it('says the editor is missing and offers to choose another', async () => {
    mountRepo();
    listPage('page.tsx');
    h.openFailures.push(
      new CommandError({
        kind: 'editor_missing',
        message: "editor binary 'code' not found in PATH",
      }),
    );
    mount();
    await rowNamed('page.tsx');

    fireEvent.click(screen.getByRole('button', { name: 'Open page.tsx in VS Code' }));

    expect(await screen.findByText(/^Couldn't open page.tsx in VS Code\./)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Choose editor' })).toBeDefined();
  });

  it('names the file and leaves out the editor link for any other failure', async () => {
    mountRepo();
    listPage('page.tsx');
    h.openFailures.push(new Error('permission denied'));
    mount();
    await rowNamed('page.tsx');

    fireEvent.click(screen.getByRole('button', { name: 'Open page.tsx in VS Code' }));

    expect(
      await screen.findByText("Couldn't open page.tsx in VS Code. permission denied"),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Choose editor' })).toBeNull();
  });

  it('opens a folder row in the editor', async () => {
    mountRepo();
    list({ relPath: '', entries: [folder('apps')] });
    mount();
    const row = await rowNamed('apps');

    fireEvent.click(within(row).getByRole('button', { name: 'Open apps in VS Code' }));

    await waitFor(() =>
      expect(callsTo('explore_open')).toContainEqual([
        'explore_open',
        { sessionDir: DIR, relPath: 'apps', reveal: false, editor: 'code' },
      ]),
    );
  });

  it('shows a folder in Finder', async () => {
    mountRepo();
    list({ relPath: '', entries: [folder('apps')] });
    mount();
    const row = await rowNamed('apps');

    fireEvent.click(within(row).getByRole('button', { name: 'Show apps in Finder' }));

    await waitFor(() =>
      expect(callsTo('explore_open')).toContainEqual([
        'explore_open',
        { sessionDir: DIR, relPath: 'apps', reveal: true, editor: null },
      ]),
    );
  });
});

describe('ExplorePane folders outside a repository', () => {
  it('does not offer Open on a folder row, only Show in Finder', async () => {
    list({ relPath: '', entries: [folder('exports')] });
    mount();
    const row = await rowNamed('exports');

    expect(within(row).queryByRole('button', { name: /^Open / })).toBeNull();
    expect(within(row).getByRole('button', { name: 'Show exports in Finder' })).toBeDefined();
  });
});

describe('ExplorePane context menu', () => {
  const menuLabels = (): ReadonlyArray<string> =>
    screen
      .getAllByRole('menuitem')
      .map((item) => item.getAttribute('data-menu-label') ?? item.textContent ?? '');

  it('lists the same verbs as the row, in the registry order', async () => {
    mountRepo();
    list({ relPath: '', entries: [entry({ relPath: 'page.tsx' })] });
    mount();

    fireEvent.contextMenu(await rowNamed('page.tsx'));

    expect(menuLabels()).toEqual([
      'Open in editor',
      'Show in Finder',
      'Ask an agent about this file',
      'Copy path',
    ]);
  });

  it('leaves Ask out of the menu of a folder', async () => {
    mountRepo();
    list({ relPath: '', entries: [folder('apps')] });
    mount();

    fireEvent.contextMenu(await rowNamed('apps'));

    expect(menuLabels()).toEqual(['Open in editor', 'Show in Finder', 'Copy path']);
  });

  it('runs a menu verb on the row it was opened on', async () => {
    list({ relPath: '', entries: [entry({ relPath: 'notes.txt' })] });
    mount();

    fireEvent.contextMenu(await rowNamed('notes.txt'));
    fireEvent.click(screen.getByRole('menuitem', { name: /Show in Finder/ }));

    await waitFor(() =>
      expect(callsTo('explore_open')).toContainEqual([
        'explore_open',
        { sessionDir: DIR, relPath: 'notes.txt', reveal: true, editor: null },
      ]),
    );
  });
});
