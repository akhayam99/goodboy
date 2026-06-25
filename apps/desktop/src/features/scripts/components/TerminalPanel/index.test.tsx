// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn().mockImplementation(() => ({
    loadAddon: vi.fn(),
    open: vi.fn(),
    onData: vi.fn(() => ({ dispose: vi.fn() })),
    write: vi.fn(),
    writeln: vi.fn(),
    dispose: vi.fn(),
    reset: vi.fn(),
    cols: 80,
    rows: 24,
    options: {},
    unicode: { activeVersion: '6' },
  })),
}));
vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn().mockImplementation(() => ({ fit: vi.fn() })),
}));
vi.mock('@xterm/addon-webgl', () => ({
  WebglAddon: vi.fn().mockImplementation(() => ({ onContextLoss: vi.fn(), dispose: vi.fn() })),
}));
vi.mock('@xterm/addon-web-links', () => ({ WebLinksAddon: vi.fn() }));
vi.mock('@xterm/addon-clipboard', () => ({ ClipboardAddon: vi.fn() }));
vi.mock('@xterm/addon-unicode11', () => ({ Unicode11Addon: vi.fn() }));
vi.mock('@xterm/xterm/css/xterm.css', () => ({}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: { openTerminal: () => void; closeTerminal: () => void }) => T) =>
    selector({ openTerminal: vi.fn(), closeTerminal: vi.fn() }),
}));

vi.mock('../../../../shared/lib/theme', () => ({
  useThemeStore: <T,>(selector: (s: { theme: 'light' | 'dark' }) => T) =>
    selector({ theme: 'light' }),
}));

vi.mock('../../../terminal/terminal', () => ({
  invokeTerminalWrite: vi.fn(),
  invokeTerminalResize: vi.fn(),
  listenTerminalOutput: vi.fn(async () => () => undefined),
  listenTerminalExit: vi.fn(async () => () => undefined),
}));

class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
(globalThis as unknown as { ResizeObserver: typeof ResizeObserverMock }).ResizeObserver =
  ResizeObserverMock;

import { TerminalPanel } from './index';

afterEach(cleanup);

describe('TerminalPanel', () => {
  it('renders a restart button accessible by label', () => {
    render(<TerminalPanel sessionId={'sess' as never} isActive cwd={null} />);
    expect(screen.getByRole('button', { name: /restart shell/i })).toBeDefined();
  });
});
