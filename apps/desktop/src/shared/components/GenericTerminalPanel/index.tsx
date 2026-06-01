import { useEffect, useRef } from 'react';
import { Terminal, type ITheme } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { RotateCcw } from 'lucide-react';
import { useThemeStore } from '../../lib/theme';

// Driver abstraction so the same xterm renderer can be wired to either a
// long-lived session shell (TerminalPanel) or a transient lifecycle PTY
// (LifecycleTerminalPanel) without duplicating ~150 lines of setup.
export interface TerminalDriver {
  /** Send keyboard input (raw UTF-8 string) into the underlying PTY. */
  write(data: string): void;
  /** Notify PTY about a window resize. */
  resize(cols: number, rows: number): void;
  /**
   * Subscribe to output chunks. The driver is responsible for any filtering
   * (e.g. by sessionId or runId) before invoking the handler.
   */
  onOutput(handler: (bytes: Uint8Array) => void): Promise<() => void>;
  /** Subscribe to the PTY exit event. */
  onExit(handler: (exitCode: number) => void): Promise<() => void>;
}

const MAX_CACHE_CHUNKS = 500;

// Output cache keyed by terminalId so tab switches and remounts don't lose
// history. Module-level because each terminalId has its own buffer regardless
// of which component instance mounted last.
const outputCache = new Map<string, Uint8Array[]>();

export function clearTerminalCache(terminalId: string): void {
  outputCache.delete(terminalId);
}

const LIGHT_THEME: ITheme = {
  background: '#f8f8f8',
  foreground: '#1a1a2e',
  cursor: '#4078f2',
  selectionBackground: '#4078f230',
  black: '#383a42',
  red: '#e45649',
  green: '#50a14f',
  yellow: '#c18401',
  blue: '#4078f2',
  magenta: '#a626a4',
  cyan: '#0184bc',
  white: '#fafafa',
  brightBlack: '#696c77',
  brightRed: '#e45649',
  brightGreen: '#50a14f',
  brightYellow: '#986801',
  brightBlue: '#4078f2',
  brightMagenta: '#a626a4',
  brightCyan: '#0184bc',
  brightWhite: '#ffffff',
};

const DARK_THEME: ITheme = {
  background: '#1a1a1f',
  foreground: '#e6e6e6',
  cursor: '#8ab4f8',
  selectionBackground: '#8ab4f840',
  black: '#3c3c3c',
  red: '#ff7b72',
  green: '#7ee787',
  yellow: '#f0c674',
  blue: '#8ab4f8',
  magenta: '#d2a8ff',
  cyan: '#79c0ff',
  white: '#d0d0d0',
  brightBlack: '#6e7681',
  brightRed: '#ffa198',
  brightGreen: '#7ee787',
  brightYellow: '#ffd66e',
  brightBlue: '#8ab4f8',
  brightMagenta: '#d2a8ff',
  brightCyan: '#79c0ff',
  brightWhite: '#ffffff',
};

interface Props {
  /** Stable id used to scope the output cache across remounts. */
  readonly terminalId: string;
  readonly driver: TerminalDriver;
  readonly isActive: boolean;
  /** When true, keyboard input is dropped (still subscribes to output). */
  readonly readOnly?: boolean;
  /** Optional message appended on exit. Empty string suppresses it. */
  readonly exitMessage?: string;
  /** Optional restart action. Renders the ↻ button when provided. */
  readonly onRestart?: () => void;
  /** Optional notification when the PTY exits. */
  readonly onExit?: (exitCode: number) => void;
}

const DEFAULT_EXIT_MESSAGE = '\r\n\x1B[90m[process exited]\x1B[0m';

export function GenericTerminalPanel({
  terminalId,
  driver,
  isActive,
  readOnly = false,
  exitMessage = DEFAULT_EXIT_MESSAGE,
  onRestart,
  onExit,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      convertEol: true,
      scrollback: 5000,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      fontSize: 12,
      lineHeight: 1.4,
      theme: theme === 'dark' ? DARK_THEME : LIGHT_THEME,
      disableStdin: readOnly,
      screenReaderMode: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);
    if (isActive) fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Replay cached output so switching tabs/remounts don't lose history.
    const cached = outputCache.get(terminalId) ?? [];
    for (const chunk of cached) {
      term.write(chunk);
    }

    const dataDisposable = readOnly
      ? null
      : term.onData((data) => {
          driver.write(data);
        });

    let unlistenOutput: (() => void) | null = null;
    let unlistenExit: (() => void) | null = null;
    let mounted = true;

    driver
      .onOutput((bytes) => {
        const cache = outputCache.get(terminalId) ?? [];
        if (cache.length < MAX_CACHE_CHUNKS) {
          cache.push(bytes);
          outputCache.set(terminalId, cache);
        }
        if (mounted) term.write(bytes);
      })
      .then((fn) => {
        if (mounted) unlistenOutput = fn;
        else fn();
      });

    driver
      .onExit((exitCode) => {
        if (!mounted) return;
        if (exitMessage) term.writeln(exitMessage);
        onExit?.(exitCode);
      })
      .then((fn) => {
        if (mounted) unlistenExit = fn;
        else fn();
      });

    const ro = new ResizeObserver(() => {
      fitAddon.fit();
      driver.resize(term.cols, term.rows);
    });
    ro.observe(container);

    return () => {
      mounted = false;
      dataDisposable?.dispose();
      unlistenOutput?.();
      unlistenExit?.();
      ro.disconnect();
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminalId]);

  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.theme = theme === 'dark' ? DARK_THEME : LIGHT_THEME;
  }, [theme]);

  useEffect(() => {
    if (isActive) {
      const id = requestAnimationFrame(() => {
        fitAddonRef.current?.fit();
        if (!readOnly) termRef.current?.focus();
      });
      return () => cancelAnimationFrame(id);
    }
  }, [isActive, readOnly]);

  return (
    <div className="relative size-full overflow-hidden" inert={!isActive} aria-hidden={!isActive}>
      <div
        ref={containerRef}
        role="group"
        aria-label="Terminal"
        className="size-full overflow-hidden"
      />
      {onRestart ? (
        <button
          type="button"
          onClick={onRestart}
          title="restart shell"
          aria-label="restart shell"
          className="absolute right-2 top-2 z-10 rounded-sm bg-background/80 p-1 text-muted-foreground backdrop-blur hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        >
          <RotateCcw size={12} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
