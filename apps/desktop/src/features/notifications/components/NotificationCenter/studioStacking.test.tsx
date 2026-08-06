// @vitest-environment happy-dom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Notification } from '@goodboy/db';
import { StudioShell } from '../../../../shared/components/StudioShell';

const { state } = vi.hoisted(() => ({
  state: {
    notifications: [] as ReadonlyArray<Notification>,
    notificationCounts: { total: 0, unread: 0 },
    notificationsLoading: false,
    loadNotifications: vi.fn(async () => undefined),
    markNotificationsRead: vi.fn(async () => undefined),
    clearNotifications: vi.fn(async () => undefined),
    retrySummarizer: vi.fn(),
    retryStepSummary: vi.fn(async () => undefined),
    summarizerStatus: {} as Record<string, unknown>,
    sessions: [] as ReadonlyArray<{ readonly id: string; readonly providerPreference?: unknown }>,
    providers: [] as ReadonlyArray<{ id: string; connection: string }>,
    currentWorkspaceId: 'ws-1' as string | null,
    currentSessionId: null as string | null,
    setCurrentSession: vi.fn(async () => undefined),
    setCurrentWorkspace: vi.fn(async () => undefined),
    setActiveLens: vi.fn(),
    selectAgent: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../store', () => {
  const useAppStore = <T,>(selector: (s: typeof state) => T) => selector(state);
  (useAppStore as unknown as { getState: () => typeof state }).getState = () => state;
  return { useAppStore };
});

import { NotificationCenter } from './index';

const stylesCssPath = resolve(__dirname, '../../../../styles.css');
const studioShellPath = resolve(__dirname, '../../../../shared/components/StudioShell/index.tsx');

const readZIndexToken = (name: string): number => {
  const css = readFileSync(stylesCssPath, 'utf8');
  const match = css.match(new RegExp(`--z-index-${name}:\\s*([0-9]+);`));
  if (!match) {
    throw new Error(`--z-index-${name} not found in styles.css`);
  }
  return Number(match[1]);
};

const extractThemeBlock = (css: string): string => {
  const themeStart = css.indexOf('@theme');
  if (themeStart === -1) {
    throw new Error('@theme block not found in styles.css');
  }
  const braceStart = css.indexOf('{', themeStart);
  let depth = 0;
  let i = braceStart;
  for (; i < css.length; i += 1) {
    if (css[i] === '{') {
      depth += 1;
    } else if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        break;
      }
    }
  }
  return css.slice(braceStart + 1, i);
};

beforeEach(() => {
  state.notifications = [];
  state.notificationCounts = { total: 0, unread: 0 };
  state.notificationsLoading = false;
  state.currentWorkspaceId = 'ws-1';
  state.currentSessionId = null;
});
afterEach(cleanup);

describe('transient popover stacking above a full-page studio', () => {
  it('keeps StudioShell fullscreen pinned at z-50', () => {
    const source = readFileSync(studioShellPath, 'utf8');
    expect(source).toContain("'fixed inset-x-0 bottom-9 top-9 z-50 flex flex-col bg-background'");
  });

  it('orders the named z-scale above the z-50 studio floor', () => {
    const studio = 50;
    const popoverBackdrop = readZIndexToken('popover-backdrop');
    const popover = readZIndexToken('popover');
    const commandPalette = readZIndexToken('command-palette');
    const tooltip = readZIndexToken('tooltip');
    const toast = readZIndexToken('toast');

    expect(popoverBackdrop).toBeGreaterThan(studio);
    expect(popover).toBeGreaterThan(popoverBackdrop);
    expect(commandPalette).toBeGreaterThan(popover);
    expect(tooltip).toBeGreaterThan(commandPalette);
    expect(toast).toBeGreaterThan(tooltip);
  });

  it('keeps the z-index tokens inside the @theme block so tailwind actually generates their utilities', () => {
    const css = readFileSync(stylesCssPath, 'utf8');
    const tokenPattern = /--z-index-[a-z-]+:\s*[0-9]+;/g;
    const allTokens = css.match(tokenPattern) ?? [];
    const themeTokens = extractThemeBlock(css).match(tokenPattern) ?? [];

    expect(allTokens.length).toBeGreaterThan(0);
    expect(themeTokens.length).toBe(allTokens.length);
  });

  it('renders the notifications popover above an open full-page studio, mid animation', async () => {
    const { container } = render(
      <>
        <StudioShell
          title="GitHub"
          workspaceName="acme"
          closeLabel="close github studio"
          onClose={() => {}}
        >
          {() => <p>studio body</p>}
        </StudioShell>
        <NotificationCenter />
      </>,
    );

    const shell = container.querySelector('[data-studio-overlay]') as HTMLElement;
    expect(shell.className).toContain('z-50');
    expect(shell.className).toContain('animate-studio-in');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^notifications$/i }));
    });

    expect(screen.getByText(/nothing to catch up on/i)).toBeDefined();

    const backdrop = document.body.querySelector('.z-popover-backdrop');
    const popoverPanel = document.body.querySelector('.z-popover');
    expect(backdrop).not.toBeNull();
    expect(popoverPanel).not.toBeNull();

    expect(shell.className).toContain('z-50');
    expect(shell.className).toContain('animate-studio-in');
  });
});
