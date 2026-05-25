import { useCallback, useEffect, useRef } from 'react';
import { Terminal, type ITheme } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { RotateCcw } from 'lucide-react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useThemeStore } from '../../../../shared/lib/theme';
import {
  invokeTerminalWrite,
  invokeTerminalResize,
  listenTerminalOutput,
  listenTerminalExit,
} from '../../../terminal/terminal';

// Persists terminal output across tab switches and remounts, keyed by sessionId.
const outputCache = new Map<SessionId, Uint8Array[]>();
const MAX_CACHE_CHUNKS = 500;

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

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function stringToBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

interface TerminalPanelProps {
  readonly sessionId: SessionId;
  readonly isActive: boolean;
  readonly cwd: string | null;
}

export function TerminalPanel({ sessionId, isActive, cwd }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  const openTerminal = useAppStore((s) => s.openTerminal);
  const closeTerminal = useAppStore((s) => s.closeTerminal);
  const theme = useThemeStore((s) => s.theme);

  // Restart: kill the shell, clear cached output + xterm buffer, spawn a fresh shell.
  const handleRestart = useCallback(async () => {
    const term = termRef.current;
    try {
      await closeTerminal(sessionId);
    } catch {
      // best-effort
    }
    outputCache.delete(sessionId);
    if (term) {
      term.reset();
      const cols = term.cols;
      const rows = term.rows;
      await openTerminal(sessionId, cwd, cols, rows);
    }
  }, [sessionId, cwd, closeTerminal, openTerminal]);

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
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);
    if (isActive) fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Replay cached output so switching tabs doesn't lose history.
    const cached = outputCache.get(sessionId) ?? [];
    for (const chunk of cached) {
      term.write(chunk);
    }

    const dataDisposable = term.onData((data) => {
      void invokeTerminalWrite(sessionId, stringToBase64(data));
    });

    let unlistenOutput: (() => void) | null = null;
    let unlistenExit: (() => void) | null = null;
    let mounted = true;

    listenTerminalOutput((payload) => {
      if (payload.sessionId !== sessionId) return;
      const bytes = base64ToBytes(payload.data);
      const cache = outputCache.get(sessionId) ?? [];
      if (cache.length < MAX_CACHE_CHUNKS) {
        cache.push(bytes);
        outputCache.set(sessionId, cache);
      }
      if (mounted) term.write(bytes);
    }).then((fn) => {
      if (mounted) unlistenOutput = fn;
      else fn();
    });

    listenTerminalExit((payload) => {
      if (payload.sessionId !== sessionId) return;
      if (mounted) term.writeln('\r\n\x1B[90m[shell exited — click ↻ to restart]\x1B[0m');
    }).then((fn) => {
      if (mounted) unlistenExit = fn;
      else fn();
    });

    const ro = new ResizeObserver(() => {
      fitAddon.fit();
      void invokeTerminalResize(sessionId, term.cols, term.rows);
    });
    ro.observe(container);

    // Open the bash shell on first tab visit (lazy).
    void openTerminal(sessionId, cwd, term.cols, term.rows);

    return () => {
      mounted = false;
      dataDisposable.dispose();
      unlistenOutput?.();
      unlistenExit?.();
      ro.disconnect();
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // React to global light/dark toggle without remounting the terminal.
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.theme = theme === 'dark' ? DARK_THEME : LIGHT_THEME;
  }, [theme]);

  useEffect(() => {
    if (isActive) {
      const id = requestAnimationFrame(() => {
        fitAddonRef.current?.fit();
      });
      return () => cancelAnimationFrame(id);
    }
  }, [isActive]);

  return (
    <div className="relative size-full overflow-hidden">
      <div ref={containerRef} className="size-full overflow-hidden" />
      <button
        type="button"
        onClick={() => void handleRestart()}
        title="restart shell"
        aria-label="restart shell"
        className="absolute right-2 top-2 z-10 rounded-sm bg-background/80 p-1 text-muted-foreground backdrop-blur hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
      >
        <RotateCcw size={12} aria-hidden />
      </button>
    </div>
  );
}
