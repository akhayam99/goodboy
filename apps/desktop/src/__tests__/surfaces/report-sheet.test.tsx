// @vitest-environment happy-dom

const bridge = vi.hoisted(() => ({
  mode: 'gh-cli' as 'gh-cli' | 'absent',
  similar: '[]',
  lastCrash: null as null | Record<string, unknown>,
  menuHandlers: [] as Array<() => void>,
  calls: [] as Array<{
    readonly command: string;
    readonly args: ReadonlyArray<string>;
    readonly url?: string;
  }>,
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(
    async (
      command: string,
      payload?: { readonly args?: ReadonlyArray<string>; readonly url?: string },
    ) => {
      const args = payload?.args ?? [];
      bridge.calls.push({ command, args, url: payload?.url });
      if (command === 'gh_status') {
        return {
          available: bridge.mode !== 'absent',
          mode: bridge.mode,
          version: '2.80.0',
          user: bridge.mode === 'absent' ? null : 'rowan',
          scopes: [],
          scoped: false,
        };
      }
      if (command === 'last_crash_claim') {
        const claimed = bridge.lastCrash;
        bridge.lastCrash = null;
        return claimed;
      }
      if (command === 'app_platform') {
        return { os: 'macos', osVersion: '26.0', arch: 'aarch64', buildSha: '7f3a2c1' };
      }
      if (command === 'gh_run' && args[0] === 'search') {
        return { stdout: bridge.similar, stderr: '', exitCode: 0 };
      }
      if (command === 'gh_run' && args[0] === 'issue' && args[1] === 'create') {
        return {
          stdout: 'https://github.com/akhayam99/goodboy/issues/1917\n',
          stderr: '',
          exitCode: 0,
        };
      }
      if (command === 'gh_run' && args[0] === 'issue' && args[1] === 'comment') {
        return {
          stdout: 'https://github.com/akhayam99/goodboy/issues/1542#issuecomment-1\n',
          stderr: '',
          exitCode: 0,
        };
      }
      return undefined;
    },
  ),
}));
vi.mock('@tauri-apps/api/app', () => ({ getVersion: vi.fn(async () => '0.12.0') }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/api/webviewWindow', () => ({
  getCurrentWebviewWindow: () => ({
    listen: vi.fn(async (event: string, handler: () => void) => {
      if (event === 'goodboy://report-open') {
        bridge.menuHandlers.push(handler);
      }
      return () => undefined;
    }),
  }),
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import { ToastProvider } from '../../shared/components/Toast';
import { seedBoardScene } from '../../app/components/MockScene/scenes/BoardScene';
import { ReportSheetHost } from '../../features/bug-report/components/ReportSheetHost';
import { openReportSheet } from '../../features/bug-report/openReportSheet';
import { LastCrashBridge } from '../../features/bug-report/components/LastCrashBridge';

const MAC_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15';

let useAppStore: StoryStore;
let clipboard: Array<string> = [];

beforeAll(async () => {
  useAppStore = await importStore();
  Object.defineProperty(navigator, 'userAgent', { value: MAC_AGENT, configurable: true });
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  seedBoardScene();
  bridge.mode = 'gh-cli';
  bridge.similar = '[]';
  bridge.calls = [];
  bridge.lastCrash = null;
  bridge.menuHandlers = [];
  clipboard = [];
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: vi.fn(async (text: string) => {
        clipboard.push(text);
      }),
    },
  });
});

afterEach(() => {
  cleanup();
});

const mount = () =>
  render(
    <ToastProvider>
      <textarea aria-label="Terminal input" className="xterm-helper-textarea" />
      <ReportSheetHost />
      <LastCrashBridge />
    </ToastProvider>,
  );

const LAST_CRASH = {
  kind: 'panic',
  source: 'window',
  message: 'TypeError: rows is undefined at /Users/rowan/code/core-api/.env for Cascade',
  stack: 'at Row (/src/Row.tsx:4)',
  screen: 'Session › Agents',
  appVersion: '0.11.1',
  actions: [],
  occurredAt: Date.parse('2026-09-26T18:42:00.000Z'),
};

const pressReportShortcut = (target: Element) => {
  fireEvent.keyDown(target, { key: 'i', code: 'KeyI', metaKey: true });
};

const openFromTerminal = async () => {
  mount();
  const terminal = screen.getByRole('textbox', { name: 'Terminal input' });
  terminal.focus();
  pressReportShortcut(terminal);
  const sheet = await screen.findByRole('dialog', { name: 'Report a bug' });
  await within(sheet).findByText('macOS 26.0 arm64');
  await within(sheet).findByText('Public issue on GitHub as @rowan');
  return sheet;
};

const sentText = (sheet: HTMLElement): string => {
  fireEvent.click(within(sheet).getByRole('button', { name: /what gets sent/i }));
  return within(sheet).getByLabelText('What gets sent', { selector: 'pre' }).textContent ?? '';
};

const ghRuns = (verb: string) =>
  bridge.calls.filter((call) => call.command === 'gh_run' && call.args[1] === verb);

describe('report sheet on the real store', () => {
  it('opens on command I with the terminal focused and puts the cursor in the line', async () => {
    const sheet = await openFromTerminal();

    expect(document.activeElement).toBe(within(sheet).getByRole('textbox', { name: /one line/i }));
    for (const chip of ['0.12.0 · 7f3a2c1', 'macOS 26.0 arm64', 'Board']) {
      expect(within(sheet).getByText(chip)).toBeDefined();
    }
  });

  it('sends one line with command enter through gh and links the issue in the toast', async () => {
    const sheet = await openFromTerminal();
    const line = within(sheet).getByRole('textbox', { name: /one line/i });
    fireEvent.change(line, { target: { value: 'Board columns jump when a session moves' } });
    fireEvent.keyDown(line, { key: 'Enter', metaKey: true });

    await waitFor(() => expect(ghRuns('create')).toHaveLength(1));
    const args = ghRuns('create')[0]?.args ?? [];
    expect(args.slice(0, 4)).toEqual(['issue', 'create', '--repo', 'akhayam99/goodboy']);
    expect(args[args.indexOf('--title') + 1]).toBe('Board columns jump when a session moves');
    const body = args[args.indexOf('--body') + 1] ?? '';
    expect(body).toContain('Type: Bug');
    expect(body).toContain('Version: 0.12.0 (build 7f3a2c1)');
    expect(body).toContain('Screen: Board');
    expect(await screen.findByText('Issue #1917 filed')).toBeDefined();
    expect(screen.queryByRole('dialog', { name: 'Report a bug' })).toBeNull();
    expect(useAppStore.getState().bugReportDraft.title).toBe('');
  });

  it('shows every attached part in the preview and drops the one you remove', async () => {
    const sheet = await openFromTerminal();
    fireEvent.change(within(sheet).getByRole('textbox', { name: /one line/i }), {
      target: { value: 'The retry spinner never stops' },
    });

    const before = sentText(sheet);
    expect(before).toContain('System: macOS 26.0 arm64');
    expect(before).toContain('Screen: Board');

    fireEvent.click(within(sheet).getByRole('button', { name: 'Remove Board' }));
    const after = within(sheet).getByLabelText('What gets sent', { selector: 'pre' }).textContent;
    expect(after).not.toContain('Screen: Board');
    expect(within(sheet).getByRole('button', { name: 'Attach Board' })).toBeDefined();
  });

  it('redacts a notification before it reaches the preview', async () => {
    mount();
    act(() => {
      openReportSheet({
        notice: {
          title: 'Push failed for rowan@example.dev',
          body: 'git push with ghp_AbCdEfGhIjKlMnOpQrSt1234 in /Users/rowan/code/core-api failed for Cascade',
        },
      });
    });
    const sheet = await screen.findByRole('dialog', { name: 'Report this' });
    await within(sheet).findByText('macOS 26.0 arm64');

    const sent = sentText(sheet);
    for (const leak of ['rowan@example.dev', 'ghp_AbCd', '/Users/rowan', 'Cascade', 'core-api']) {
      expect(sent).not.toContain(leak);
    }
    expect(sent).toContain('[email]');
    expect(within(sheet).getByText(/things redacted · nothing from your prompts/)).toBeDefined();
  });

  it('falls back to a prefilled link without GitHub and puts the overflow on the clipboard', async () => {
    bridge.mode = 'absent';
    mount();
    act(() => {
      openReportSheet();
    });
    const sheet = await screen.findByRole('dialog', { name: 'Report a bug' });
    await within(sheet).findByText('Opens GitHub in your browser. You submit it there.');
    fireEvent.change(within(sheet).getByRole('textbox', { name: /one line/i }), {
      target: { value: 'Board columns jump' },
    });
    fireEvent.click(within(sheet).getByRole('button', { name: /add detail/i }));
    fireEvent.change(within(sheet).getByRole('textbox', { name: 'Detail' }), {
      target: { value: 'steps '.repeat(1200) },
    });
    fireEvent.click(within(sheet).getByRole('button', { name: /open on github/i }));

    await waitFor(() =>
      expect(bridge.calls.filter((call) => call.command === 'open_url')).toHaveLength(1),
    );
    const opened = bridge.calls.find((call) => call.command === 'open_url');
    expect(ghRuns('create')).toHaveLength(0);
    expect(clipboard).toHaveLength(1);
    expect(clipboard[0]).toContain('Board columns jump');
    expect(await screen.findByText('Finish on GitHub')).toBeDefined();
    const url = opened?.url ?? '';
    expect(url.length).toBeLessThanOrEqual(4096);
    expect(
      url.startsWith(
        'https://github.com/akhayam99/goodboy/issues/new?title=Board%20columns%20jump',
      ),
    ).toBe(true);
    expect(decodeURIComponent(url)).toContain('It is on your clipboard');
  });

  it('offers the open issue that matches and adds the report there as a comment', async () => {
    bridge.similar = JSON.stringify([
      {
        number: 1542,
        title: 'Board reflows after a session finishes',
        url: 'https://github.com/akhayam99/goodboy/issues/1542',
        commentsCount: 3,
      },
    ]);
    const sheet = await openFromTerminal();
    fireEvent.change(within(sheet).getByRole('textbox', { name: /one line/i }), {
      target: { value: 'Board columns jump when a session moves' },
    });

    fireEvent.click(
      await within(sheet).findByRole('button', { name: 'Add mine there' }, { timeout: 2000 }),
    );

    await waitFor(() => expect(ghRuns('comment')).toHaveLength(1));
    expect(ghRuns('comment')[0]?.args.slice(0, 3)).toEqual(['issue', 'comment', '1542']);
    expect(ghRuns('create')).toHaveLength(0);
    expect(await screen.findByText('Added to #1542')).toBeDefined();
  });

  it('opens from the macOS Help menu item', async () => {
    mount();
    await waitFor(() => expect(bridge.menuHandlers).toHaveLength(1));

    act(() => {
      bridge.menuHandlers[0]?.();
    });

    expect(await screen.findByRole('dialog', { name: 'Report a bug' })).toBeDefined();
  });

  it('offers the crash from last launch once and opens the sheet with it attached', async () => {
    bridge.lastCrash = LAST_CRASH;
    mount();

    expect(await screen.findByText('Goodboy closed unexpectedly last time')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Report it' }));

    const sheet = await screen.findByRole('dialog', { name: 'Report this crash' });
    await within(sheet).findByText('macOS 26.0 arm64');
    expect(within(sheet).getByRole('textbox', { name: /one line/i })).toHaveProperty(
      'value',
      'Goodboy closed unexpectedly last time',
    );
    expect(within(sheet).getByText('Error and stack')).toBeDefined();
    const sent = sentText(sheet);
    expect(sent).toContain('In 0.11.1, on Session › Agents');
    for (const leak of ['/Users/rowan', 'Cascade', 'core-api']) {
      expect(sent).not.toContain(leak);
    }
    await waitFor(() =>
      expect(bridge.calls.filter((call) => call.command === 'last_crash_delete')).toHaveLength(1),
    );
    expect(bridge.calls.filter((call) => call.command === 'last_crash_claim')).toHaveLength(1);
  });

  it('says the app hit an error, not that it closed, when it kept running', async () => {
    bridge.lastCrash = { ...LAST_CRASH, kind: 'error', actions: ['nav.back', 'lens.agents'] };
    mount();

    expect(await screen.findByText('Goodboy hit an error last time')).toBeDefined();
    expect(screen.queryByText(/closed unexpectedly/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Report it' }));

    const sheet = await screen.findByRole('dialog', { name: 'Report this error' });
    await within(sheet).findByText('macOS 26.0 arm64');
    expect(within(sheet).getByRole('textbox', { name: /one line/i })).toHaveProperty(
      'value',
      'Goodboy hit an error last time',
    );
    expect(sentText(sheet)).toContain('Last actions: nav.back, lens.agents');
  });

  it('deletes the saved crash when the toast is dismissed', async () => {
    bridge.lastCrash = LAST_CRASH;
    mount();

    await screen.findByText('Goodboy closed unexpectedly last time');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));

    await waitFor(() =>
      expect(bridge.calls.filter((call) => call.command === 'last_crash_delete')).toHaveLength(1),
    );
    expect(screen.queryByRole('dialog', { name: 'Report this crash' })).toBeNull();
  });
});
