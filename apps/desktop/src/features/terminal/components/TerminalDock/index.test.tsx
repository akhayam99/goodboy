// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import type { TerminalTab, TerminalTabId } from '../../../../shared/types/terminal';

const { platform } = vi.hoisted(() => ({ platform: { current: 'darwin' as 'darwin' | 'linux' } }));

vi.mock('../../../../shared/platform', () => ({ currentPlatform: () => platform.current }));

const { addTerminalTab, state } = vi.hoisted(() => {
  const spawn = vi.fn();
  return {
    addTerminalTab: spawn,
    state: {
      terminalTabs: {} as Record<string, ReadonlyArray<unknown>>,
      activeTerminalTab: {} as Record<string, string | null>,
      addTerminalTab: spawn,
      closeTerminalTab: vi.fn(),
      setActiveTerminalTab: vi.fn(),
      setTerminalTabStatus: vi.fn(),
    },
  };
});

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

vi.mock('../../../../shared/components/GenericTerminalPanel/LazyGenericTerminalPanel', () => ({
  LazyGenericTerminalPanel: () => null,
}));

vi.mock('../../terminal', () => ({
  invokeTerminalOpen: vi.fn(async () => undefined),
  invokeTerminalResize: vi.fn(async () => undefined),
  invokeTerminalWrite: vi.fn(async () => undefined),
  listenTerminalExit: vi.fn(async () => () => undefined),
  listenTerminalOutput: vi.fn(async () => () => undefined),
}));

vi.mock('../../closeTab', () => ({ disposeTerminalPty: vi.fn() }));

import { TerminalDock } from './index';

const SESSION_ID = 'session-1' as SessionId;
const TAB_ID = 'terminal-1' as TerminalTabId;

const tab = {
  id: TAB_ID,
  sessionId: SESSION_ID,
  title: 'zsh',
  cwd: '/repo',
  status: 'running',
  createdAt: 0,
} satisfies TerminalTab;

const mountDock = () => {
  render(<TerminalDock sessionId={SESSION_ID} isActive cwd="/repo" />);
  return screen.getByRole('tab');
};

beforeEach(() => {
  state.terminalTabs = { [SESSION_ID]: [tab] };
  state.activeTerminalTab = { [SESSION_ID]: TAB_ID };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  platform.current = 'darwin';
});

describe('TerminalDock new tab shortcut', () => {
  it('spawns a tab on the command combo on darwin', () => {
    platform.current = 'darwin';
    const target = mountDock();

    fireEvent.keyDown(target, { code: 'KeyT', metaKey: true });

    expect(addTerminalTab).toHaveBeenCalledTimes(1);
    expect(addTerminalTab).toHaveBeenCalledWith(SESSION_ID, '/repo');
  });

  it('leaves the control combos to the pty on darwin', () => {
    platform.current = 'darwin';
    const target = mountDock();

    fireEvent.keyDown(target, { code: 'KeyT', ctrlKey: true });
    fireEvent.keyDown(target, { code: 'KeyT', ctrlKey: true, shiftKey: true });

    expect(addTerminalTab).not.toHaveBeenCalled();
  });

  it('spawns a tab on control shift off darwin', () => {
    platform.current = 'linux';
    const target = mountDock();

    fireEvent.keyDown(target, { code: 'KeyT', ctrlKey: true, shiftKey: true });

    expect(addTerminalTab).toHaveBeenCalledTimes(1);
    expect(addTerminalTab).toHaveBeenCalledWith(SESSION_ID, '/repo');
  });

  it('leaves plain control to the pty off darwin', () => {
    platform.current = 'linux';
    const target = mountDock();

    fireEvent.keyDown(target, { code: 'KeyT', ctrlKey: true });

    expect(addTerminalTab).not.toHaveBeenCalled();
  });
});
