import { useEffect, useMemo, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { ClipboardAddon } from '@xterm/addon-clipboard';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { SearchAddon } from '@xterm/addon-search';
import '@xterm/xterm/css/xterm.css';
import { RotateCcw } from 'lucide-react';
import { getAppliedTheme, subscribeAppliedTheme } from '../../lib/theme';
import { openUrl } from '../../lib/editor';
import { resolveTerminalTheme } from './terminal-theme';
import { Tooltip } from '@goodboy/ui';
import { terminalFindKey } from './terminalFindKey';
import { terminalFindOptions } from './terminalFindDecorations';
import { TerminalFindBar, type TerminalFindController } from './TerminalFindBar';
import { ICON_SIZE } from '../conceptIcons';

export type TerminalChunk = {
  readonly bytes: Uint8Array;
  readonly offset: number | null;
};

export type TerminalSnapshot = {
  readonly bytes: Uint8Array;
  readonly offset: number;
  readonly exitCode: number | null;
};

export type TerminalDriver = {
  write(data: string): void;
  resize(cols: number, rows: number): void;
  onOutput(handler: (chunk: TerminalChunk) => void): Promise<() => void>;
  onExit(handler: (exitCode: number) => void): Promise<() => void>;
  snapshot?(): Promise<TerminalSnapshot | null>;
};

type Props = {
  readonly terminalId: string;
  readonly driver: TerminalDriver;
  readonly isActive: boolean;
  readonly readOnly?: boolean;
  readonly exitMessage?: string;
  readonly onRestart?: () => void;
  readonly onExit?: (exitCode: number) => void;
};

const DEFAULT_EXIT_MESSAGE = '\r\n\x1B[90m[process exited]\x1B[0m';

export const GenericTerminalPanel = ({
  terminalId,
  driver,
  isActive,
  readOnly = false,
  exitMessage = DEFAULT_EXIT_MESSAGE,
  onRestart,
  onExit,
}: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAndSyncRef = useRef<(() => void) | null>(null);
  const searchRef = useRef<SearchAddon | null>(null);
  const isFindOpenRef = useRef(false);
  const findTermRef = useRef('');
  const [findStep, setFindStep] = useState<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const term = new Terminal({
      convertEol: true,
      scrollback: 5000,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      fontSize: 12,
      lineHeight: 1.4,
      theme: resolveTerminalTheme(getAppliedTheme()),
      disableStdin: readOnly,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new Unicode11Addon());
    term.unicode.activeVersion = '11';
    term.loadAddon(new ClipboardAddon());
    term.loadAddon(new WebLinksAddon((_event, uri) => void openUrl(uri)));
    const searchAddon = new SearchAddon();
    term.loadAddon(searchAddon);
    searchRef.current = searchAddon;
    term.attachCustomKeyEventHandler((event) => {
      const key = terminalFindKey({ event, isOpen: isFindOpenRef.current });
      if (key === null) {
        return true;
      }
      event.preventDefault();
      event.stopPropagation();
      if (key === 'open') {
        setFindStep((previous) => (previous ?? 0) + 1);
        return false;
      }
      const findTerm = findTermRef.current;
      const options = terminalFindOptions({ theme: getAppliedTheme() });
      if (findTerm.length > 0 && key === 'next') {
        searchAddon.findNext(findTerm, options);
      }
      if (findTerm.length > 0 && key === 'previous') {
        searchAddon.findPrevious(findTerm, options);
      }
      return false;
    });
    term.open(container);

    let webgl: WebglAddon | null = null;
    try {
      webgl = new WebglAddon();
    } catch {
      webgl = null;
    }
    if (webgl) {
      webgl.onContextLoss(() => webgl?.dispose());
      term.loadAddon(webgl);
    }

    const fitAndSync = () => {
      if (!container.clientWidth || !container.clientHeight) {
        return;
      }
      fitAddon.fit();
      driver.resize(term.cols, term.rows);
    };

    if (isActive) {
      fitAndSync();
    }

    termRef.current = term;
    fitAndSyncRef.current = fitAndSync;

    const dataDisposable = readOnly
      ? null
      : term.onData((data) => {
          driver.write(data);
        });

    let unlistenOutput: (() => void) | null = null;
    let unlistenExit: (() => void) | null = null;
    let mounted = true;
    let firstOutputSynced = false;
    let hasExited = false;
    let snapshotEnd: number | null = null;
    let isReplaying = driver.snapshot !== undefined;
    const pending: TerminalChunk[] = [];

    const writeChunk = (chunk: TerminalChunk) => {
      let bytes = chunk.bytes;
      if (chunk.offset !== null && snapshotEnd !== null) {
        const skip = snapshotEnd - chunk.offset;
        if (skip >= bytes.length) {
          return;
        }
        if (skip > 0) {
          bytes = bytes.subarray(skip);
        }
      }
      term.write(bytes);
      if (!firstOutputSynced) {
        firstOutputSynced = true;
        fitAndSync();
      }
    };

    const finish = (exitCode: number) => {
      if (hasExited) {
        return;
      }
      hasExited = true;
      if (exitMessage) {
        term.writeln(exitMessage);
      }
      onExit?.(exitCode);
    };

    const start = async () => {
      const stopOutput = await driver.onOutput((chunk) => {
        if (!mounted) {
          return;
        }
        if (isReplaying) {
          pending.push(chunk);
          return;
        }
        writeChunk(chunk);
      });
      if (!mounted) {
        stopOutput();
        return;
      }
      unlistenOutput = stopOutput;
      const stopExit = await driver.onExit((exitCode) => {
        if (mounted) {
          finish(exitCode);
        }
      });
      if (!mounted) {
        stopExit();
        return;
      }
      unlistenExit = stopExit;
      if (driver.snapshot === undefined) {
        return;
      }
      const snapshot = await driver.snapshot();
      if (!mounted) {
        return;
      }
      if (snapshot !== null) {
        snapshotEnd = snapshot.offset + snapshot.bytes.length;
        if (snapshot.bytes.length > 0) {
          term.write(snapshot.bytes);
          firstOutputSynced = true;
          fitAndSync();
        }
      }
      isReplaying = false;
      for (const chunk of pending.splice(0)) {
        writeChunk(chunk);
      }
      if (snapshot !== null && snapshot.exitCode !== null) {
        finish(snapshot.exitCode);
      }
    };
    void start();

    const ro = new ResizeObserver(() => {
      fitAndSync();
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
      searchRef.current = null;
      fitAndSyncRef.current = null;
    };
  }, [terminalId]);

  useEffect(
    () =>
      subscribeAppliedTheme(() => {
        const term = termRef.current;
        if (!term) {
          return;
        }
        term.options.theme = resolveTerminalTheme(getAppliedTheme());
      }),
    [],
  );

  useEffect(() => {
    if (isActive) {
      const id = requestAnimationFrame(() => {
        fitAndSyncRef.current?.();
        if (!readOnly) {
          termRef.current?.focus();
        }
      });
      return () => cancelAnimationFrame(id);
    }
  }, [isActive, readOnly]);

  const findController = useMemo(
    (): TerminalFindController => ({
      findNext: (findTerm) => {
        findTermRef.current = findTerm;
        searchRef.current?.findNext(findTerm, terminalFindOptions({ theme: getAppliedTheme() }));
      },
      findPrevious: (findTerm) => {
        findTermRef.current = findTerm;
        searchRef.current?.findPrevious(
          findTerm,
          terminalFindOptions({ theme: getAppliedTheme() }),
        );
      },
      clear: () => {
        findTermRef.current = '';
        searchRef.current?.clearDecorations();
      },
      onResults: (listener) => {
        const disposable = searchRef.current?.onDidChangeResults((event) =>
          listener({ index: event.resultIndex, count: event.resultCount }),
        );
        return () => disposable?.dispose();
      },
    }),
    [],
  );

  const closeFind = () => {
    isFindOpenRef.current = false;
    setFindStep(null);
    termRef.current?.focus();
  };

  isFindOpenRef.current = findStep !== null;

  return (
    <div className="relative size-full overflow-hidden" inert={!isActive} aria-hidden={!isActive}>
      <div
        ref={containerRef}
        role="group"
        aria-label="Terminal"
        className="size-full overflow-hidden"
      />
      {findStep === null ? null : (
        <TerminalFindBar controller={findController} step={findStep} onClose={closeFind} />
      )}
      {onRestart && findStep === null ? (
        <Tooltip content="Restart shell">
          <button
            type="button"
            onClick={onRestart}
            aria-label="Restart shell"
            className="absolute right-2 top-2 z-10 rounded-sm bg-background p-1 text-muted-foreground backdrop-blur hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <RotateCcw size={ICON_SIZE.row} aria-hidden />
          </button>
        </Tooltip>
      ) : null}
    </div>
  );
};
