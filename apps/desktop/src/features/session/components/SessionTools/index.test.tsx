import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ExploreEntry } from '../../../explore/explore';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { TerminalTabId } from '../../../../shared/types/terminal';
import type { OpenDrawer } from '../../../../store/slices/drawer/state';
import { brandedId } from '../../../history/testing/brandedId';
import { tooltipTextOf } from '../../../../__tests__/helpers/tooltip';
import { SESSION, WORKSPACE, sessionFixture } from '../../../../__tests__/helpers/actionFixtures';
import { DrawerHost } from '../../../../app/components/DrawerHost';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  SESSION_ID,
  seedActivityRunScene,
} from '../../../../app/components/MockScene/scenes/activityRunSeed';
import { SessionTools } from '.';
import { SESSION_TOOLS, WORKSPACE_TOOLS } from './sessionTools';

const ALL_TOOLS = [...SESSION_TOOLS, ...WORKSPACE_TOOLS];
import { SESSION_TOOL_RAIL_WIDTH } from './sessionToolRailWidth';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  seedActivityRunScene();
});

afterEach(() => {
  cleanup();
});

const renderCluster = () =>
  render(
    <ToastProvider>
      <SessionTools sessionId={SESSION_ID} />
      <DrawerHost />
    </ToastProvider>,
  );

const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

const toggle = (name: 'ask' | 'terminal' | 'browser' | 'explore' | 'context' | 'scripts') =>
  screen.getByTestId(`pane-toggle-${name}`);

const drawerKind = () => useAppStore.getState().drawer?.kind ?? null;

const TERMINAL: OpenDrawer = {
  kind: 'terminal',
  sessionId: SESSION_ID,
  payload: { terminalId: brandedId<TerminalTabId>({ value: `${SESSION_ID}::t1` }) },
};

const CONTEXT: OpenDrawer = {
  kind: 'context',
  sessionId: SESSION_ID,
  payload: { section: 'goal', view: 'current' },
};

const README: ExploreEntry = {
  name: 'README.md',
  relPath: 'README.md',
  isDir: false,
  sizeBytes: 120,
  modifiedAt: null,
};

describe('SessionTools', () => {
  it('stacks Explore, Context, Ask, Agents, Scripts and Terminal as icons in a vertical toolbar', () => {
    renderCluster();
    const toolbar = screen.getByRole('toolbar', { name: 'Tools' });
    expect(toolbar.getAttribute('aria-orientation')).toBe('vertical');
    const buttons = within(toolbar).getAllByRole('button');
    expect(buttons.map((button) => button.getAttribute('aria-label')?.split(',')[0])).toEqual([
      'Explore',
      'Context',
      'Ask this session',
      'Agents',
      'Scripts',
      'Terminal',
      'Browser',
    ]);
    expect(buttons.map((button) => button.textContent)).toEqual(['', '', '', '', '', '', '']);
    expect(buttons.every((button) => button.querySelector('svg') !== null)).toBe(true);
    expect(within(toolbar).queryByRole('button', { name: /^More/ })).toBeNull();
  });

  it('keeps each tool on its pane id and chord whatever its place in the column', () => {
    renderCluster();
    expect(SESSION_TOOLS.map((tool) => [tool.pane, tool.shortcut])).toEqual([
      ['explore', 'lens.explore'],
      ['context', 'lens.context'],
      ['ask', 'ask.open'],
      ['spawned', 'session.spawned'],
      ['scripts', 'lens.scripts'],
    ]);
    expect(WORKSPACE_TOOLS.map((tool) => [tool.pane, tool.shortcut])).toEqual([
      ['terminal', 'terminal.studio'],
      ['browser', undefined],
    ]);
    const toolbar = screen.getByRole('toolbar', { name: 'Tools' });
    for (const pane of ['explore', 'context', 'ask', 'spawned', 'scripts', 'terminal', 'browser']) {
      within(toolbar).getByTestId(`pane-toggle-${pane}`);
    }
  });

  it('draws one separator between the session and workspace groups, and no more', () => {
    renderCluster();
    const toolbar = screen.getByRole('toolbar', { name: 'Tools' });
    const order = Array.from(
      toolbar.querySelectorAll(
        '[data-testid^="pane-toggle-"], [data-testid="session-tools-separator"]',
      ),
    ).map((node) => node.getAttribute('data-testid')?.replace('pane-toggle-', ''));
    expect(order).toEqual([
      'explore',
      'context',
      'ask',
      'spawned',
      'scripts',
      'session-tools-separator',
      'terminal',
      'browser',
    ]);
    const separators = within(toolbar).getAllByRole('separator');
    expect(separators.every((separator) => separator.tagName === 'SPAN')).toBe(true);
    expect(within(toolbar).getAllByRole('button').length).toBe(7);
  });

  it('names each icon with its label and chord in the tooltip on the left', () => {
    renderCluster();

    for (const tool of ALL_TOOLS) {
      expect(tooltipTextOf({ element: screen.getByTestId(`pane-toggle-${tool.pane}`) })).toContain(
        tool.label,
      );
      if (tool.shortcut !== undefined) {
        expect(
          tooltipTextOf({ element: screen.getByTestId(`pane-toggle-${tool.pane}`) }),
        ).toContain(shortcutGlyphs(tool.shortcut));
      }
    }
  });

  it('names every tool under its icon, secondary when closed and full strength when open', () => {
    renderCluster();
    const captions = ALL_TOOLS.map((tool) =>
      screen
        .getByTestId(`pane-toggle-${tool.pane}`)
        .closest('[data-slot="session-tool"]')
        ?.querySelector('[data-slot="tool-caption"]'),
    );
    expect(captions.map((caption) => caption?.textContent)).toEqual(
      ALL_TOOLS.map((tool) => tool.label),
    );
    expect(captions.every((caption) => caption?.getAttribute('data-tone') === 'closed')).toBe(true);
    fireEvent.click(toggle('scripts'));
    const open = toggle('scripts')
      .closest('[data-slot="session-tool"]')
      ?.querySelector('[data-slot="tool-caption"]');
    expect(open?.getAttribute('data-tone')).toBe('open');
    expect(
      captions.filter((caption) => caption?.getAttribute('data-tone') === 'closed'),
    ).toHaveLength(6);
  });

  it('keeps every label inside the 44px rail at the 9px caption size', () => {
    const contentWidth = SESSION_TOOL_RAIL_WIDTH - 2 * 2;
    const widestGlyphEm = 0.55;
    const captionPx = 9;
    for (const tool of ALL_TOOLS) {
      expect(tool.label.length * widestGlyphEm * captionPx).toBeLessThanOrEqual(contentWidth);
    }
  });

  it('hides all captions together on a short window and fits the rail at 600px', () => {
    renderCluster();
    const source = readFileSync(join(__dirname, 'SessionToolButton.tsx'), 'utf8');
    expect(source).toContain('[@media(max-height:480px)]:hidden');
    expect(document.querySelectorAll('[data-slot="tool-caption"]')).toHaveLength(ALL_TOOLS.length);
    const button = 32;
    const caption = 12;
    const captionGap = 2;
    const railGap = 8;
    const headerInset = 12;
    const groups = new Set(ALL_TOOLS.map((tool) => tool.group)).size;
    const children = ALL_TOOLS.length + 2 * groups;
    const needed =
      headerInset +
      groups * caption +
      ALL_TOOLS.length * (button + captionGap + caption) +
      (children - 1) * railGap +
      (groups - 1);
    expect(needed).toBeLessThan(600 - 120);
  });

  it('draws the Context dot on the icon as a badge, not after a word', () => {
    renderCluster();
    act(() => {
      useAppStore.setState((state) => ({
        summarizerStatus: {
          ...state.summarizerStatus,
          [SESSION_ID]: {
            status: 'running',
            lastUpdate: null,
            error: null,
            lastUsage: null,
            lastAttempt: null,
          },
        },
      }));
    });

    const dot = screen.getByTestId('tool-signal');
    expect(dot.parentElement?.contains(toggle('context'))).toBe(true);
    expect(toggle('context').contains(dot)).toBe(false);
    expect(toggle('context').textContent).toBe('');
  });

  it('keeps one tab stop and moves it with the arrow keys, Home and End', () => {
    renderCluster();
    const toolbar = screen.getByRole('toolbar', { name: 'Tools' });
    const buttons = within(toolbar).getAllByRole('button');
    expect(buttons.map((button) => button.tabIndex)).toEqual([0, -1, -1, -1, -1, -1, -1]);
    act(() => {
      buttons[0]?.focus();
    });
    fireEvent.keyDown(toolbar, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(buttons[1]);
    fireEvent.keyDown(toolbar, { key: 'End' });
    expect(document.activeElement).toBe(buttons[6]);
    fireEvent.keyDown(toolbar, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(buttons[0]);
    fireEvent.keyDown(toolbar, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(buttons[6]);
    expect(buttons.map((button) => button.tabIndex)).toEqual([-1, -1, -1, -1, -1, -1, 0]);
  });

  it('presses the icon of the open pane', async () => {
    renderCluster();
    fireEvent.click(toggle('scripts'));
    await settle();
    expect(drawerKind()).toBe('scripts');
    expect(toggle('scripts').getAttribute('aria-pressed')).toBe('true');
    expect(toggle('scripts').closest('[data-slot="session-tool"]')?.textContent).toBe('Scripts');
    expect(toggle('scripts').getAttribute('data-icon-tone')).toBe('info');
    expect(toggle('ask').getAttribute('aria-pressed')).toBe('false');
    expect(toggle('ask').hasAttribute('data-icon-tone')).toBe(false);
  });

  it('marks Context with a pulsing dot while the summary runs and a danger dot when it failed', async () => {
    const seed = (status: 'running' | 'error') =>
      act(() => {
        useAppStore.setState((state) => ({
          summarizerStatus: {
            ...state.summarizerStatus,
            [SESSION_ID]: {
              status,
              lastUpdate: null,
              error: null,
              lastUsage: null,
              lastAttempt: null,
            },
          },
        }));
      });
    renderCluster();

    seed('running');
    expect(screen.getByTestId('tool-signal').getAttribute('data-signal')).toBe('running');
    expect(toggle('context').getAttribute('aria-label')).toBe('Context, Updating context');
    expect(tooltipTextOf({ element: toggle('context') })).toContain('Updating context');

    seed('error');
    expect(screen.getByTestId('tool-signal').getAttribute('data-signal')).toBe('error');
    expect(toggle('context').getAttribute('aria-label')).toBe(
      "Context, Couldn't update the context. Open to retry.",
    );
    expect(toggle('ask').getAttribute('aria-label')).toBe('Ask this session');
  });

  it('opens one pane at a time: a second toggle replaces the first', async () => {
    renderCluster();

    fireEvent.click(toggle('ask'));
    await settle();
    expect(drawerKind()).toBe('ask');
    expect(toggle('ask').getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(toggle('explore'));
    await settle();
    expect(drawerKind()).toBe('explore');
    expect(toggle('ask').getAttribute('aria-pressed')).toBe('false');
    expect(toggle('explore').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('region', { name: 'Explore' })).toBeDefined();
  });

  it('closes the open pane when its toggle is pressed again', async () => {
    renderCluster();

    fireEvent.click(toggle('explore'));
    await settle();
    fireEvent.click(toggle('explore'));
    await settle();

    expect(drawerKind()).toBeNull();
  });

  it('opens Context and Scripts from their own rows', async () => {
    renderCluster();

    fireEvent.click(toggle('scripts'));
    await settle();
    expect(drawerKind()).toBe('scripts');
    expect(screen.getByRole('region', { name: 'Scripts' })).toBeDefined();

    fireEvent.click(toggle('context'));
    await settle();
    expect(drawerKind()).toBe('context');
    expect(toggle('context').getAttribute('aria-pressed')).toBe('true');
    expect(toggle('scripts').getAttribute('aria-pressed')).toBe('false');
  });

  it('keeps Explore lit on a file it opened and walks back to the files', async () => {
    renderCluster();
    act(() => {
      useAppStore.getState().openDrawer({
        kind: 'explore-file',
        sessionId: SESSION_ID,
        payload: { sessionDir: '/work/harborline/payments-api', entry: README, from: 'explore' },
      });
    });
    await settle();
    expect(toggle('explore').getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Back to Explore' }));
    await settle();

    expect(drawerKind()).toBe('explore');
  });

  it('walks a script output opened from Scripts back to the scripts', async () => {
    renderCluster();
    act(() => {
      useAppStore.getState().openDrawer({
        kind: 'scriptRun',
        sessionId: SESSION_ID,
        payload: { scriptKey: 'pnpm test', mountId: null, from: 'scripts' },
      });
    });
    await settle();

    fireEvent.click(screen.getByRole('button', { name: 'Back to scripts' }));
    await settle();

    expect(drawerKind()).toBe('scripts');
  });

  it('raises the Scripts dot for a failed run and clears it once that output is opened', async () => {
    useAppStore.setState({
      scriptRuns: {
        [SESSION_ID]: {
          'pnpm test': {
            status: 'error',
            result: { stdout: 'FAIL postings', stderr: '', exitCode: 1 },
            runId: 'run-9',
            startedAt: 1_000,
            completedAt: 13_000,
            name: 'test',
          },
        },
      },
      scriptRunsSeen: {},
    });
    renderCluster();
    const signal = () => toggle('scripts').closest('.relative')?.querySelector('[data-signal]');
    expect(signal()?.getAttribute('data-signal')).toBe('error');
    expect(tooltipTextOf({ element: toggle('scripts') })).toContain(
      'test failed. Open its output.',
    );
    expect(toggle('scripts').getAttribute('aria-label')).toBe(
      'Scripts, test failed. Open its output.',
    );

    act(() => {
      useAppStore.getState().openDrawer({
        kind: 'scriptRun',
        sessionId: SESSION_ID,
        payload: { scriptKey: 'pnpm test', mountId: null, from: 'scripts' },
      });
    });
    await settle();

    expect(signal()).toBeNull();
    expect(useAppStore.getState().scriptRunsSeen[SESSION_ID]?.['pnpm test']).toBe('run-9');
  });

  it('keeps the Scripts dot off for a run that failed before and is opened already', () => {
    useAppStore.setState({
      scriptRuns: {
        [SESSION_ID]: {
          'pnpm test': {
            status: 'error',
            result: { stdout: 'FAIL', stderr: '', exitCode: 1 },
            runId: 'run-9',
            startedAt: 1_000,
            completedAt: 2_000,
            name: 'test',
          },
        },
      },
      scriptRunsSeen: { [SESSION_ID]: { 'pnpm test': 'run-9' } },
    });
    renderCluster();

    expect(toggle('scripts').closest('.relative')?.querySelector('[data-signal]')).toBeNull();
  });

  it('captions the Session group, and leaves Terminal and Browser under the separator', () => {
    renderCluster();
    const toolbar = screen.getByRole('toolbar', { name: 'Tools' });
    const order = Array.from(
      toolbar.querySelectorAll(
        '[data-slot="tool-group-caption"], [data-testid^="pane-toggle-"], [data-testid="session-tools-separator"]',
      ),
    ).map((node) =>
      node.getAttribute('data-slot') === 'tool-group-caption'
        ? `caption:${node.textContent}`
        : node.getAttribute('data-testid')?.replace('pane-toggle-', ''),
    );
    expect(order).toEqual([
      'caption:Session',
      'explore',
      'context',
      'ask',
      'spawned',
      'scripts',
      'session-tools-separator',
      'terminal',
      'browser',
    ]);
    const source = readFileSync(join(__dirname, 'ToolGroupCaption.tsx'), 'utf8');
    expect(source).toContain('text-rail');
    expect(source).toContain('[@media(max-height:480px)]:hidden');
    expect(toolbar.style.width).toBe(`${SESSION_TOOL_RAIL_WIDTH}px`);
  });

  it('rests every tool until one holds the slot or waits behind it', () => {
    renderCluster();
    const states = Array.from(document.querySelectorAll('[data-slot="session-tool"]')).map((node) =>
      node.getAttribute('data-state'),
    );
    expect(states).toEqual(ALL_TOOLS.map(() => 'rest'));
    expect(screen.queryByTestId('tool-waiting')).toBeNull();
  });

  it('presses the tool in the slot and rings the one waiting in the back chip', () => {
    renderCluster();
    act(() => {
      useAppStore.setState({
        drawer: { kind: 'scripts', sessionId: SESSION_ID, payload: null },
        drawerBack: TERMINAL,
      });
    });
    const stateOf = (name: 'scripts' | 'terminal' | 'ask') =>
      toggle(name).closest('[data-slot="session-tool"]')?.getAttribute('data-state');
    expect(stateOf('scripts')).toBe('pressed');
    expect(stateOf('terminal')).toBe('waiting');
    expect(stateOf('ask')).toBe('rest');
    expect(screen.getAllByTestId('tool-waiting')).toHaveLength(1);
    expect(
      toggle('terminal').closest('.relative')?.querySelector('[data-testid="tool-waiting"]'),
    ).not.toBeNull();
    expect(toggle('terminal').getAttribute('aria-label')).toBe('Terminal, waiting');
    expect(toggle('scripts').getAttribute('aria-label')).toBe('Scripts');
    expect(toggle('terminal').getAttribute('aria-pressed')).toBe('false');
    expect(toggle('ask').getAttribute('aria-label')).toBe('Ask this session');
  });

  it('swaps the ring and the pressed tool when the waiting tool is clicked', () => {
    renderCluster();
    act(() => {
      useAppStore.setState({
        drawer: { kind: 'scripts', sessionId: SESSION_ID, payload: null },
        drawerBack: { kind: 'ask', sessionId: SESSION_ID, payload: null },
      });
    });
    const stateOf = (name: 'scripts' | 'ask') =>
      toggle(name).closest('[data-slot="session-tool"]')?.getAttribute('data-state');

    fireEvent.click(toggle('ask'));

    expect(stateOf('ask')).toBe('pressed');
    expect(stateOf('scripts')).toBe('waiting');
    expect(screen.getAllByTestId('tool-waiting')).toHaveLength(1);
    expect(toggle('ask').getAttribute('aria-pressed')).toBe('true');
    expect(toggle('scripts').getAttribute('aria-label')).toBe('Scripts, waiting');

    fireEvent.click(toggle('scripts'));

    expect(stateOf('scripts')).toBe('pressed');
    expect(stateOf('ask')).toBe('waiting');
  });

  it('brings the waiting drawer back with its own payload when its tool is clicked', () => {
    const versions: OpenDrawer = {
      kind: 'context',
      sessionId: SESSION_ID,
      payload: { section: 'summary', view: 'versions' },
    };
    renderCluster();
    act(() => {
      useAppStore.setState({
        drawer: { kind: 'scripts', sessionId: SESSION_ID, payload: null },
        drawerBack: versions,
      });
    });

    fireEvent.click(toggle('context'));

    expect(useAppStore.getState().drawer).toEqual(versions);
    expect(drawerKind()).toBe('context');
    expect(useAppStore.getState().drawerBack?.kind).toBe('scripts');
  });

  it('keeps the signal dot beside the ring on a waiting tool', () => {
    renderCluster();
    act(() => {
      useAppStore.setState((state) => ({
        drawer: { kind: 'ask', sessionId: SESSION_ID, payload: null },
        drawerBack: CONTEXT,
        summarizerStatus: {
          ...state.summarizerStatus,
          [SESSION_ID]: {
            status: 'running',
            lastUpdate: null,
            error: null,
            lastUsage: null,
            lastAttempt: null,
          },
        },
      }));
    });
    const tool = toggle('context').closest('[data-slot="session-tool"]');
    expect(tool?.getAttribute('data-state')).toBe('waiting');
    expect(tool?.querySelector('[data-testid="tool-waiting"]')).not.toBeNull();
    expect(tool?.querySelector('[data-signal="running"]')).not.toBeNull();
    expect(toggle('context').getAttribute('aria-label')).toBe('Context, waiting, Updating context');
  });

  it('rings nothing when the back chip holds a reader, and when it holds the pressed tool', () => {
    renderCluster();
    act(() => {
      useAppStore.setState({
        drawer: { kind: 'ask', sessionId: SESSION_ID, payload: null },
        drawerBack: {
          kind: 'conversation',
          sessionId: SESSION_ID,
          payload: { threadId: 'thread-1' },
        },
      });
    });
    expect(screen.queryByTestId('tool-waiting')).toBeNull();
    act(() => {
      useAppStore.setState({
        drawerBack: { kind: 'ask', sessionId: SESSION_ID, payload: null },
      });
    });
    expect(screen.queryByTestId('tool-waiting')).toBeNull();
  });

  it('shows a running dot on Scripts while a script runs', () => {
    useAppStore.setState({
      scriptRuns: {
        [SESSION_ID]: {
          dev: { status: 'pending', result: null, runId: 'run-1', startedAt: 1_000, name: 'dev' },
        },
      },
    });
    renderCluster();

    expect(
      toggle('scripts')
        .closest('.relative')
        ?.querySelector('[data-signal]')
        ?.getAttribute('data-signal'),
    ).toBe('running');
  });

  it('keeps focus on the same tool when the rail moves into a page and back', () => {
    seedActivityRunScene();
    const { rerender } = render(<SessionTools key="shell" sessionId={SESSION_ID} />);
    act(() => toggle('browser').focus());

    rerender(<SessionTools key="page" sessionId={null} />);
    expect(document.activeElement).toBe(toggle('browser'));
    expect(toggle('browser').tabIndex).toBe(0);

    rerender(<SessionTools key="shell-again" sessionId={SESSION_ID} />);
    expect(document.activeElement).toBe(toggle('browser'));
    expect(toggle('explore').tabIndex).toBe(-1);
  });

  it('keeps only the Workspace group off a session, Terminal and Browser at the bottom', () => {
    render(<SessionTools sessionId={null} />);
    const toolbar = screen.getByRole('toolbar', { name: 'Tools' });

    expect(
      within(toolbar)
        .getAllByRole('button')
        .map((button) => button.getAttribute('data-testid')),
    ).toEqual(['pane-toggle-terminal', 'pane-toggle-browser']);
    expect(toolbar.querySelector('[data-slot="tool-group-caption"]')).toBeNull();
    expect(within(toolbar).queryByRole('separator')).toBeNull();
  });

  it('names the running terminals and shows their count on Terminal', () => {
    useAppStore.setState({
      terminalTabs: {
        [SESSION_ID]: [
          {
            id: brandedId<TerminalTabId>({ value: `${SESSION_ID}::t1` }),
            owner: { kind: 'session', sessionId: SESSION_ID },
            title: 'pnpm dev',
            cwd: null,
            status: 'running',
            createdAt: 1,
          },
          {
            id: brandedId<TerminalTabId>({ value: `${SESSION_ID}::t2` }),
            owner: { kind: 'session', sessionId: SESSION_ID },
            title: 'shell',
            cwd: null,
            status: 'running',
            createdAt: 2,
          },
        ],
      },
    });
    render(<SessionTools sessionId={null} />);

    expect(toggle('terminal').getAttribute('aria-label')).toBe('Terminal, 2 running');
    const tool = toggle('terminal').closest('[data-slot="session-tool"]');
    expect(tool?.querySelector('[data-testid="tool-count"]')?.textContent).toBe('2');
    expect(tool?.querySelector('[data-signal]')).toBeNull();
    expect(
      toggle('browser')
        .closest('[data-slot="session-tool"]')
        ?.querySelector('[data-testid="tool-count"]'),
    ).toBeNull();
  });

  it('shows the open browser tabs as a count on Browser', () => {
    const titles = ['Harborline', 'Northwind', 'Acme', 'Cascadia'];
    useAppStore.setState({
      currentWorkspaceId: WORKSPACE,
      sessions: [sessionFixture()],
      browserSessionTabs: {
        [SESSION]: titles.map((title, position) => ({
          id: `tab-${position}`,
          sessionId: SESSION,
          projectId: null,
          url: `https://${title.toLowerCase()}.test`,
          title,
          position,
          createdAt: position,
          updatedAt: position,
        })),
      },
    });
    render(<SessionTools sessionId={null} />);

    expect(toggle('browser').getAttribute('aria-label')).toBe('Browser, 4 tabs');
    expect(
      toggle('browser')
        .closest('[data-slot="session-tool"]')
        ?.querySelector('[data-testid="tool-count"]')?.textContent,
    ).toBe('4');
  });

  it('selects Terminal while its page is open and does nothing on click', () => {
    useAppStore.setState({
      appStudio: { kind: 'terminal', terminalId: null, sessionId: null },
    });
    render(<SessionTools sessionId={null} />);

    expect(toggle('terminal').getAttribute('aria-current')).toBe('page');
    expect(
      toggle('terminal').closest('[data-slot="session-tool"]')?.getAttribute('data-state'),
    ).toBe('current');
    fireEvent.click(toggle('terminal'));
    expect(useAppStore.getState().appStudio?.kind).toBe('terminal');
    expect(drawerKind()).toBeNull();
  });
});
