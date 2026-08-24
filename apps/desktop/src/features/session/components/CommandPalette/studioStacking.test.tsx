// @vitest-environment happy-dom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Notification } from '@goodboy/db';

const { state, toastMock } = vi.hoisted(() => ({
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
    skills: {} as Record<string, ReadonlyArray<unknown>>,
    phaseTemplates: {} as Record<string, ReadonlyArray<unknown>>,
    projectScripts: {} as Record<string, ReadonlyArray<unknown>>,
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<unknown>>,
    sessionWorktrees: {} as Record<string, ReadonlyArray<string>>,
    agentKindOverride: {} as Record<string, string>,
    openWorkspace: vi.fn(async () => undefined),
    runScript: vi.fn(async () => ({ exitCode: 0 })),
  },
  toastMock: vi.fn(),
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [] as readonly never[],
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
  useWorkspaces: () => [],
  useSessions: () => [],
  useCurrentWorkspace: () => null,
  useCurrentSession: () => null,
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: toastMock }),
}));

import { NotificationCenter } from '../../../notifications/components/NotificationCenter';
import { CommandPalette } from './index';

const stylesCssPath = resolve(__dirname, '../../../../styles.css');

const readZIndexToken = (name: string): number => {
  const css = readFileSync(stylesCssPath, 'utf8');
  const match = css.match(new RegExp(`--z-index-${name}:\\s*([0-9]+);`));
  if (!match) {
    throw new Error(`--z-index-${name} not found in styles.css`);
  }
  return Number(match[1]);
};

afterEach(cleanup);

describe('command palette summoned over an open app-global popover', () => {
  it('sits above the popover layer in the named z-scale', () => {
    const popover = readZIndexToken('popover');
    const commandPalette = readZIndexToken('command-palette');
    expect(commandPalette).toBeGreaterThan(popover);
  });

  it('renders above the notifications popover backdrop, not underneath it', async () => {
    render(
      <>
        <NotificationCenter />
        <CommandPalette onClose={() => {}} />
      </>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^notifications$/i }));
    });

    const backdrop = document.body.querySelector('.z-popover-backdrop');
    expect(backdrop).not.toBeNull();

    const palette = document.body.querySelector('.z-command-palette');
    expect(palette).not.toBeNull();
  });
});
