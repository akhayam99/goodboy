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

const toggle = (name: 'terminal' | 'browser') => screen.getByTestId(`pane-toggle-${name}`);

const drawerKind = () => useAppStore.getState().drawer?.kind ?? null;

const TERMINAL: OpenDrawer = {
  kind: 'terminal',
  sessionId: SESSION_ID,
  payload: { terminalId: brandedId<TerminalTabId>({ value: `${SESSION_ID}::t1` }) },
};

const BROWSER: OpenDrawer = { kind: 'browser', sessionId: SESSION_ID, payload: null };

const stateOf = (name: 'terminal' | 'browser') =>
  toggle(name).closest('[data-slot="session-tool"]')?.getAttribute('data-state');

describe('SessionTools', () => {
  it('holds Terminal and Browser only, as icons in a vertical toolbar under the Tools caption', () => {
    render(<SessionTools sessionId={SESSION_ID} />);
    const toolbar = screen.getByRole('toolbar', { name: 'Tools' });
    expect(toolbar.getAttribute('aria-orientation')).toBe('vertical');
    const buttons = within(toolbar).getAllByRole('button');
    expect(buttons.map((button) => button.getAttribute('aria-label')?.split(',')[0])).toEqual([
      'Terminal',
      'Browser',
    ]);
    expect(buttons.every((button) => button.querySelector('svg') !== null)).toBe(true);
    expect(within(toolbar).queryByRole('separator')).toBeNull();
    const order = Array.from(
      toolbar.querySelectorAll('[data-slot="tool-group-caption"], [data-testid^="pane-toggle-"]'),
    ).map((node) =>
      node.getAttribute('data-slot') === 'tool-group-caption'
        ? `caption:${node.textContent}`
        : node.getAttribute('data-testid')?.replace('pane-toggle-', ''),
    );
    expect(order).toEqual(['caption:Tools', 'terminal', 'browser']);
    expect(toolbar.style.width).toBe(`${SESSION_TOOL_RAIL_WIDTH}px`);
    const source = readFileSync(join(__dirname, 'ToolGroupCaption.tsx'), 'utf8');
    expect(source).toContain('[@media(max-height:480px)]:hidden');
  });

  it('is the same rail outside a session', () => {
    render(<SessionTools sessionId={null} />);
    const toolbar = screen.getByRole('toolbar', { name: 'Tools' });
    expect(
      within(toolbar)
        .getAllByRole('button')
        .map((button) => button.getAttribute('data-testid')),
    ).toEqual(['pane-toggle-terminal', 'pane-toggle-browser']);
    expect(toolbar.querySelector('[data-slot="tool-group-caption"]')?.textContent).toBe('Tools');
  });

  it('keeps each tool on its pane id and chord', () => {
    expect(RAIL_TOOLS.map((tool) => [tool.pane, tool.shortcut])).toEqual([
      ['terminal', 'terminal.studio'],
      ['browser', 'browser.address'],
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

  it('keeps every label inside the 44px rail at the 9px caption size', () => {
    const contentWidth = SESSION_TOOL_RAIL_WIDTH - 2 * 2;
    for (const tool of RAIL_TOOLS) {
      expect(tool.label.length * 0.55 * 9).toBeLessThanOrEqual(contentWidth);
    }
  });

  it('keeps one tab stop and moves it with the arrow keys, Home and End', () => {
    render(<SessionTools sessionId={SESSION_ID} />);
    const toolbar = screen.getByRole('toolbar', { name: 'Tools' });
    const buttons = within(toolbar).getAllByRole('button');
    expect(buttons.map((button) => button.tabIndex)).toEqual([0, -1]);
    act(() => {
      buttons[0]?.focus();
    });
    fireEvent.keyDown(toolbar, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(buttons[1]);
    fireEvent.keyDown(toolbar, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(buttons[0]);
    fireEvent.keyDown(toolbar, { key: 'End' });
    expect(document.activeElement).toBe(buttons[1]);
    expect(buttons.map((button) => button.tabIndex)).toEqual([-1, 0]);
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
    expect(
      toggle('browser')
        .closest('[data-slot="session-tool"]')
        ?.querySelector('[data-testid="tool-count"]')?.textContent,
    ).toBe('4');
  });

  it('shows no count on Browser until the tab rows have loaded', () => {
    useAppStore.setState({
      currentWorkspaceId: WORKSPACE,
      sessions: [sessionFixture()],
      browserTabCounts: {},
    });
    render(<SessionTools sessionId={null} />);

    expect(toggle('browser').getAttribute('aria-label')).toBe('Browser');
    const tool = toggle('browser').closest('[data-slot="session-tool"]');
    expect(tool?.querySelector('[data-testid="tool-count"]')).toBeNull();
    const skeleton = tool?.querySelector('[data-testid="tool-count-skeleton"]');
    expect(skeleton?.getAttribute('aria-label')).toBe('Loading');
  });

  it('draws no skeleton on Browser once the tab rows have loaded empty', () => {
    useAppStore.setState({
      currentWorkspaceId: WORKSPACE,
      sessions: [sessionFixture()],
      browserTabCounts: { [WORKSPACE]: 0 },
    });
    render(<SessionTools sessionId={null} />);

    expect(screen.queryByTestId('tool-count-skeleton')).toBeNull();
    expect(screen.queryByTestId('tool-count')).toBeNull();
  });

  it('draws no skeleton and no count on Browser when the tab rows failed to load', () => {
    useAppStore.setState({
      currentWorkspaceId: WORKSPACE,
      sessions: [sessionFixture()],
      browserTabCounts: {},
      browserTabCountFailures: { [WORKSPACE]: true },
    });
    render(<SessionTools sessionId={null} />);

    expect(screen.queryByTestId('tool-count-skeleton')).toBeNull();
    expect(screen.queryByTestId('tool-count')).toBeNull();
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
