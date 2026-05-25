import { useEffect, useMemo, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { invokeScriptResize, invokeScriptWrite, listenScriptOutput } from '../../scripts';

// Persists terminal output across tab switches and remounts, keyed by sessionId.
const outputCache = new Map<SessionId, Uint8Array[]>();
const MAX_CACHE_CHUNKS = 500;

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
}

export function TerminalPanel({ sessionId, isActive }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  const scriptRuns = useAppStore((s) => s.scriptRuns[sessionId]);

  // Refs updated each render so event listener closures always see current values.
  const sessionRunIdsRef = useRef(new Set<string>());
  const activeRunIdRef = useRef<string | null>(null);

  const runEntries = useMemo(() => Object.values(scriptRuns ?? {}), [scriptRuns]);
  sessionRunIdsRef.current = useMemo(() => new Set(runEntries.map((r) => r.runId)), [runEntries]);
  activeRunIdRef.current = useMemo(
    () => runEntries.find((r) => r.status === 'pending')?.runId ?? null,
    [runEntries],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      convertEol: true,
      scrollback: 5000,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      fontSize: 12,
      lineHeight: 1.4,
      theme: {
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
      },
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
      const runId = activeRunIdRef.current;
      if (!runId) return;
      void invokeScriptWrite(runId, stringToBase64(data));
    });

    let unlisten: (() => void) | null = null;
    let mounted = true;

    listenScriptOutput((payload) => {
      if (!sessionRunIdsRef.current.has(payload.runId)) return;
      const bytes = base64ToBytes(payload.data);
      const cache = outputCache.get(sessionId) ?? [];
      if (cache.length < MAX_CACHE_CHUNKS) {
        cache.push(bytes);
        outputCache.set(sessionId, cache);
      }
      if (mounted) term.write(bytes);
    }).then((fn) => {
      if (mounted) {
        unlisten = fn;
      } else {
        fn();
      }
    });

    const ro = new ResizeObserver(() => {
      fitAddon.fit();
      const runId = activeRunIdRef.current;
      if (!runId) return;
      void invokeScriptResize(runId, term.cols, term.rows);
    });
    ro.observe(container);

    return () => {
      mounted = false;
      dataDisposable.dispose();
      unlisten?.();
      ro.disconnect();
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isActive) {
      // Small delay lets the CSS visibility change settle before measuring.
      const id = requestAnimationFrame(() => {
        fitAddonRef.current?.fit();
      });
      return () => cancelAnimationFrame(id);
    }
  }, [isActive]);

  return <div ref={containerRef} className="size-full overflow-hidden" />;
}
