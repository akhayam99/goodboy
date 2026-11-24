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
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { ArtifactId } from '@goodboy/types';
import type { TerminalTabId } from '../../../../shared/types/terminal';
import type { OpenDrawer } from '../../../../store/slices/drawer/state';
import { brandedId } from '../../../history/testing/brandedId';
import { tooltipTextOf } from '../../../../__tests__/helpers/tooltip';
import { SESSION, WORKSPACE, sessionFixture } from '../../../../__tests__/helpers/actionFixtures';
import {
  SESSION_ID,
  seedActivityRunScene,
} from '../../../../app/components/MockScene/scenes/activityRunSeed';
import { SessionTools } from '.';
import { RAIL_TOOLS } from './sessionTools';
import { TOOL_RAIL_WIDTH_PX } from '@goodboy/ui';

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
  vi.unstubAllGlobals();
});

type WindowWidthParams = {
  readonly width: number;
};

const stubWindowWidth = ({ width }: WindowWidthParams) => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: width <= Number.parseFloat(query.replace('(max-width:', '')),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
};

type ToolName = 'terminal' | 'browser' | 'scripts' | 'ask' | 'monitoring';

const toggle = (name: ToolName) => screen.getByTestId(`pane-toggle-${name}`);

const RAIL_TEXT = 'TerminalBrowserScriptsAskMonitor';

const drawerKind = () => useAppStore.getState().drawer?.kind ?? null;

const TERMINAL: OpenDrawer = {
  kind: 'terminal',
  sessionId: SESSION_ID,
  payload: { terminalId: brandedId<TerminalTabId>({ value: `${SESSION_ID}::t1` }) },
};

const BROWSER: OpenDrawer = { kind: 'browser', sessionId: SESSION_ID, payload: null };

const stateOf = (name: ToolName) =>
  toggle(name).closest('[data-slot="session-tool"]')?.getAttribute('data-state');

describe('SessionTools', () => {
  it('holds the five tools as labelled icons in a 56px vertical toolbar with no heading', () => {
    render(<SessionTools sessionId={SESSION_ID} />);
    const toolbar = screen.getByRole('toolbar', { name: 'Tools' });
    expect(toolbar.getAttribute('aria-orientation')).toBe('vertical');
    const buttons = within(toolbar).getAllByRole('button');
    expect(buttons.map((button) => button.getAttribute('aria-label')?.split(',')[0])).toEqual([
      'Terminal',
      'Browser',
      'Scripts',
      'Ask',
      'Monitoring',
    ]);
    expect(buttons.every((button) => button.querySelector('svg') !== null)).toBe(true);
    expect(within(toolbar).queryByRole('separator')).toBeNull();
    expect(toolbar.firstElementChild?.getAttribute('data-slot')).toBe('session-tool');
    expect(toolbar.textContent).toBe(RAIL_TEXT);
    expect(TOOL_RAIL_WIDTH_PX.wide).toBe(56);
    expect(toolbar.style.width).toBe(`${TOOL_RAIL_WIDTH_PX.wide}px`);
    const source = readFileSync(join(__dirname, 'SessionToolButton.tsx'), 'utf8');
    expect(source).toContain('[@media(max-height:480px)]:hidden');
  });

  it('is the same rail outside a session, with Scripts and Ask waiting for one', () => {
    render(<SessionTools sessionId={null} />);
    const toolbar = screen.getByRole('toolbar', { name: 'Tools' });
    expect(
      within(toolbar)
        .getAllByRole('button')
        .map((button) => button.getAttribute('data-testid')),
    ).toEqual([
      'pane-toggle-terminal',
      'pane-toggle-browser',
      'pane-toggle-scripts',
      'pane-toggle-ask',
      'pane-toggle-monitoring',
    ]);
    expect(toggle('scripts').getAttribute('aria-disabled')).toBe('true');
    expect(toggle('ask').getAttribute('aria-label')).toBe('Ask, open a session first');
    expect(toggle('monitoring').getAttribute('aria-disabled')).toBeNull();
    fireEvent.click(toggle('scripts'));
    fireEvent.click(toggle('ask'));
    expect(drawerKind()).toBeNull();
  });

  it('opens the scripts panel for its session and closes it on a second press', () => {
    render(<SessionTools sessionId={SESSION_ID} />);

    fireEvent.click(toggle('scripts'));
    expect(useAppStore.getState().drawer).toMatchObject({
      kind: 'scripts',
      sessionId: SESSION_ID,
    });
    expect(stateOf('scripts')).toBe('pressed');

    fireEvent.click(toggle('scripts'));
    expect(drawerKind()).toBeNull();
    expect(stateOf('scripts')).toBe('rest');
  });

  it('opens the Ask pane of its session, lights the door, and closes it on a second press', () => {
    render(<SessionTools sessionId={SESSION_ID} />);

    fireEvent.click(toggle('ask'));
    expect(useAppStore.getState().askPaneOpen[SESSION_ID]).toBe(true);
    expect(drawerKind()).toBeNull();
    expect(stateOf('ask')).toBe('pressed');

    fireEvent.click(toggle('ask'));
    expect(useAppStore.getState().askPaneOpen[SESSION_ID]).toBe(false);
    expect(stateOf('ask')).toBe('rest');
  });

  it('opens Monitor as a window panel, beside the session and outside it, and closes it', () => {
    render(<SessionTools sessionId={null} />);

    fireEvent.click(toggle('monitoring'));
    expect(useAppStore.getState().drawer).toEqual({
      kind: 'monitoring',
      sessionId: null,
      payload: null,
    });
    expect(stateOf('monitoring')).toBe('pressed');

    fireEvent.click(toggle('monitoring'));
    expect(drawerKind()).toBeNull();
  });

  it('numbers Monitor with the ports in use, the one count the ports signal gives', () => {
    useAppStore.setState({
      monitorSnapshot: {
        listeners: [
          { port: 9000, address: '127.0.0.1', protocol: 'tcp', pid: 77 },
          { port: 4300, address: '127.0.0.1', protocol: 'tcp', pid: 78 },
        ],
        processes: [],
        takenAt: 1,
        isPlatformSupported: true,
      },
      monitorPinned: [
        { port: 9000, description: 'Mock API' },
        { port: 5173, description: 'Vite' },
      ],
    });
    render(<SessionTools sessionId={null} />);

    const badge = toggle('monitoring')
      .closest('[data-slot="tool-icon"]')
      ?.querySelector('[data-testid="tool-count"]');
    expect(badge?.textContent).toBe('1');
    expect(badge?.getAttribute('data-count-badge')).toBe('warning');
    expect(toggle('monitoring').getAttribute('aria-label')).toBe(
      'Monitoring, 1 in use, pinned port :5173 is down',
    );
    expect(screen.queryAllByTestId('tool-count')).toHaveLength(1);
  });

  it('keeps the warning on Monitor when a pinned port is down and no port is in use', () => {
    useAppStore.setState({
      monitorSnapshot: { listeners: [], processes: [], takenAt: 1, isPlatformSupported: true },
      monitorPinned: [{ port: 5173, description: 'Vite' }],
    });
    render(<SessionTools sessionId={null} />);

    const icon = toggle('monitoring').closest('[data-slot="tool-icon"]');
    expect(icon?.querySelector('[data-testid="tool-count"]')).toBeNull();
    expect(icon?.querySelector('[data-testid="tool-warning"]')?.getAttribute('data-tone')).toBe(
      'warning',
    );
    expect(toggle('monitoring').getAttribute('aria-label')).toBe(
      'Monitoring, pinned port :5173 is down',
    );
    expect(screen.queryAllByTestId('tool-warning')).toHaveLength(1);
  });

  it('draws no number on Monitor before the first port snapshot', () => {
    render(<SessionTools sessionId={null} />);

    expect(screen.queryByTestId('tool-count')).toBeNull();
    expect(toggle('monitoring').getAttribute('aria-label')).toBe('Monitoring');
  });

  it('lays every tool on one grid: icon row over label row, centred on one column', () => {
    render(<SessionTools sessionId={SESSION_ID} />);
    const tools = Array.from(document.querySelectorAll('[data-slot="session-tool"]'));
    expect(tools).toHaveLength(RAIL_TOOLS.length);
    for (const tool of tools) {
      expect(tool.className.split(' ')).toEqual(
        expect.arrayContaining(['grid', 'w-full', 'grid-rows-[auto_auto]', 'justify-items-center']),
      );
      expect(Array.from(tool.children).map((child) => child.getAttribute('data-slot'))).toEqual([
        'tool-icon',
        'tool-caption',
      ]);
    }
  });

  it('fills the pressed tool as a quiet tile with no border', () => {
    render(<SessionTools sessionId={SESSION_ID} />);
    act(() => {
      useAppStore.setState({ drawer: BROWSER });
    });
    const classes = toggle('browser').className.split(' ');
    expect(classes).toContain('aria-pressed:bg-selected');
    expect(classes.some((name) => name.startsWith('aria-pressed:border'))).toBe(false);
  });

  it('keeps each tool on its pane id and chord', () => {
    expect(RAIL_TOOLS.map((tool) => [tool.pane, tool.shortcut])).toEqual([
      ['terminal', 'terminal.studio'],
      ['browser', 'browser.address'],
      ['scripts', undefined],
      ['ask', 'ask.open'],
      ['monitoring', undefined],
    ]);
  });

  it('names each icon with its label and chord in the tooltip', () => {
    render(<SessionTools sessionId={SESSION_ID} />);
    for (const tool of RAIL_TOOLS) {
      const text = tooltipTextOf({ element: screen.getByTestId(`pane-toggle-${tool.pane}`) });
      expect(text).toContain(tool.label);
      if (tool.shortcut !== undefined) {
        expect(text).toContain(shortcutGlyphs(tool.shortcut));
      }
    }
  });

  it('names every tool under its icon, secondary when closed', () => {
    render(<SessionTools sessionId={SESSION_ID} />);
    const captions = RAIL_TOOLS.map((tool) =>
      screen
        .getByTestId(`pane-toggle-${tool.pane}`)
        .closest('[data-slot="session-tool"]')
        ?.querySelector('[data-slot="tool-caption"]'),
    );
    expect(captions.map((caption) => caption?.textContent)).toEqual(
      RAIL_TOOLS.map((tool) => tool.label),
    );
    expect(captions.every((caption) => caption?.getAttribute('data-tone') === 'closed')).toBe(true);
  });

  it('keeps every label inside the rail at the 9px caption size', () => {
    const contentWidth = TOOL_RAIL_WIDTH_PX.wide - 2 * 2;
    for (const tool of RAIL_TOOLS) {
      expect(tool.label.length * 0.55 * 9).toBeLessThanOrEqual(contentWidth);
    }
  });

  it('turns to icons only, 44 wide, under a 1100px window, the name in the tooltip', () => {
    stubWindowWidth({ width: 1024 });
    render(<SessionTools sessionId={SESSION_ID} />);
    const toolbar = screen.getByRole('toolbar', { name: 'Tools' });

    expect(toolbar.getAttribute('data-tool-rail')).toBe('narrow');
    expect(toolbar.style.width).toBe(`${TOOL_RAIL_WIDTH_PX.narrow}px`);
    expect(toolbar.querySelector('[data-slot="tool-caption"]')).toBeNull();
    expect(toolbar.textContent).toBe('');
    for (const tool of RAIL_TOOLS) {
      const text = tooltipTextOf({ element: screen.getByTestId(`pane-toggle-${tool.pane}`) });
      expect(text).toContain(tool.fullLabel ?? tool.label);
    }
  });

  it('keeps the words under the icons from a 1100px window', () => {
    stubWindowWidth({ width: 1100 });
    render(<SessionTools sessionId={SESSION_ID} />);
    const toolbar = screen.getByRole('toolbar', { name: 'Tools' });

    expect(toolbar.getAttribute('data-tool-rail')).toBe('wide');
    expect(toolbar.style.width).toBe(`${TOOL_RAIL_WIDTH_PX.wide}px`);
    expect(toolbar.textContent).toBe(RAIL_TEXT);
  });

  it('keeps one tab stop and moves it with the arrow keys, Home and End', () => {
    render(<SessionTools sessionId={SESSION_ID} />);
    const toolbar = screen.getByRole('toolbar', { name: 'Tools' });
    const buttons = within(toolbar).getAllByRole('button');
    expect(buttons.map((button) => button.tabIndex)).toEqual([0, -1, -1, -1, -1]);
    act(() => {
      buttons[0]?.focus();
    });
    fireEvent.keyDown(toolbar, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(buttons[1]);
    fireEvent.keyDown(toolbar, { key: 'End' });
    expect(document.activeElement).toBe(buttons[4]);
    fireEvent.keyDown(toolbar, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(buttons[0]);
    fireEvent.keyDown(toolbar, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(buttons[4]);
    expect(buttons.map((button) => button.tabIndex)).toEqual([-1, -1, -1, -1, 0]);
  });

  it('presses the tool in the slot and closes it when pressed again', () => {
    render(<SessionTools sessionId={SESSION_ID} />);
    act(() => {
      useAppStore.setState({ drawer: TERMINAL });
    });
    expect(stateOf('terminal')).toBe('pressed');
    expect(toggle('terminal').getAttribute('aria-pressed')).toBe('true');
    expect(toggle('terminal').getAttribute('data-icon-tone')).not.toBeNull();
    expect(stateOf('browser')).toBe('rest');
    fireEvent.click(toggle('terminal'));
    expect(drawerKind()).toBeNull();
  });

  it('rests every tool until one holds the slot or waits behind it', () => {
    render(<SessionTools sessionId={SESSION_ID} />);
    const states = Array.from(document.querySelectorAll('[data-slot="session-tool"]')).map((node) =>
      node.getAttribute('data-state'),
    );
    expect(states).toEqual(RAIL_TOOLS.map(() => 'rest'));
    expect(screen.queryByTestId('tool-waiting')).toBeNull();
  });

  it('rings the tool waiting in the back chip and swaps them when it is pressed', () => {
    render(<SessionTools sessionId={SESSION_ID} />);
    act(() => {
      useAppStore.setState({ drawer: BROWSER, drawerBack: TERMINAL });
    });
    expect(stateOf('browser')).toBe('pressed');
    expect(stateOf('terminal')).toBe('waiting');
    expect(screen.getAllByTestId('tool-waiting')).toHaveLength(1);
    expect(toggle('terminal').getAttribute('aria-label')).toBe('Terminal, waiting');

    fireEvent.click(toggle('terminal'));

    expect(stateOf('terminal')).toBe('pressed');
    expect(stateOf('browser')).toBe('waiting');
  });

  it('keeps the open tool pressed beside a reading panel and after it closes', () => {
    render(<SessionTools sessionId={SESSION_ID} />);
    const plan = {
      kind: 'artifact-document',
      sessionId: SESSION_ID,
      payload: { artifactId: brandedId<ArtifactId>({ value: 'plan-1' }), revision: null },
    } as const;
    act(() => {
      useAppStore.getState().openDrawer(TERMINAL);
      useAppStore.getState().toggleDrawer(plan);
    });
    expect(drawerKind()).toBe('artifact-document');
    expect(stateOf('terminal')).toBe('pressed');

    act(() => {
      useAppStore.getState().toggleDrawer(plan);
    });

    expect(drawerKind()).toBe('terminal');
    expect(stateOf('terminal')).toBe('pressed');
  });

  it('rings nothing when the back chip holds a reader, and when it holds the pressed tool', () => {
    render(<SessionTools sessionId={SESSION_ID} />);
    act(() => {
      useAppStore.setState({
        drawer: TERMINAL,
        drawerBack: {
          kind: 'conversation',
          sessionId: SESSION_ID,
          payload: { threadId: 'thread-1' },
        },
      });
    });
    expect(screen.queryByTestId('tool-waiting')).toBeNull();
    act(() => {
      useAppStore.setState({ drawerBack: TERMINAL });
    });
    expect(screen.queryByTestId('tool-waiting')).toBeNull();
  });

  it('keeps focus on the same tool when the rail moves into a page and back', () => {
    const { rerender } = render(<SessionTools key="shell" sessionId={SESSION_ID} />);
    act(() => toggle('browser').focus());

    rerender(<SessionTools key="page" sessionId={null} />);
    expect(document.activeElement).toBe(toggle('browser'));
    expect(toggle('browser').tabIndex).toBe(0);

    rerender(<SessionTools key="shell-again" sessionId={SESSION_ID} />);
    expect(document.activeElement).toBe(toggle('browser'));
    expect(toggle('terminal').tabIndex).toBe(-1);
  });

  it('names the running terminals on Terminal and draws no number at rest', () => {
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
    expect(tooltipTextOf({ element: toggle('terminal') })).toContain('2 running');
    const glyph = toggle('terminal')
      .closest('[data-slot="tool-icon"]')
      ?.querySelector('[data-slot="tool-glyph"]');
    expect(glyph?.className.split(' ')).toEqual(
      expect.arrayContaining(['absolute', 'left-1/2', 'top-1/2', 'size-4']),
    );
    expect(glyph?.childElementCount).toBe(0);
    expect(screen.getByRole('toolbar', { name: 'Tools' }).textContent).toBe(RAIL_TEXT);
  });

  it('names the open browser tabs on Browser and draws no number at rest', () => {
    const titles = ['Harborline', 'Northwind', 'Acme', 'Cascadia'];
    useAppStore.setState({
      currentWorkspaceId: WORKSPACE,
      sessions: [sessionFixture()],
      browserTabCounts: { [WORKSPACE]: titles.length },
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
    expect(tooltipTextOf({ element: toggle('browser') })).toContain('4 tabs');
    expect(
      toggle('browser')
        .closest('[data-slot="tool-icon"]')
        ?.querySelector('[data-slot="tool-glyph"]')?.childElementCount,
    ).toBe(0);
  });

  it.each([
    { rows: 'not loaded', browserTabCounts: {} },
    { rows: 'empty', browserTabCounts: { [WORKSPACE]: 0 } },
  ] as const)(
    'names Browser alone and draws nothing on it while its tab rows are $rows',
    ({ browserTabCounts }) => {
      useAppStore.setState({
        currentWorkspaceId: WORKSPACE,
        sessions: [sessionFixture()],
        browserTabCounts,
      });
      render(<SessionTools sessionId={null} />);

      expect(toggle('browser').getAttribute('aria-label')).toBe('Browser');
      expect(screen.queryByRole('status')).toBeNull();
      expect(screen.getByRole('toolbar', { name: 'Tools' }).textContent).toBe(RAIL_TEXT);
    },
  );

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
