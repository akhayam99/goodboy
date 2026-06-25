import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { RotateCcw } from 'lucide-react'
import { useThemeStore } from '../../lib/theme'
import { resolveTerminalTheme } from './terminal-theme'

export type TerminalDriver = {
  write(data: string): void
  resize(cols: number, rows: number): void
  onOutput(handler: (bytes: Uint8Array) => void): Promise<() => void>
  onExit(handler: (exitCode: number) => void): Promise<() => void>
}

const MAX_CACHE_CHUNKS = 500

const outputCache = new Map<string, Uint8Array[]>()

export const clearTerminalCache = (terminalId: string): void => {
  outputCache.delete(terminalId)
}

type Props = {
  readonly terminalId: string
  readonly driver: TerminalDriver
  readonly isActive: boolean
  readonly readOnly?: boolean
  readonly exitMessage?: string
  readonly onRestart?: () => void
  readonly onExit?: (exitCode: number) => void
}

const DEFAULT_EXIT_MESSAGE = '\r\n\x1B[90m[process exited]\x1B[0m'

export const GenericTerminalPanel = ({
  terminalId,
  driver,
  isActive,
  readOnly = false,
  exitMessage = DEFAULT_EXIT_MESSAGE,
  onRestart,
  onExit,
}: Props) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAndSyncRef = useRef<(() => void) | null>(null)

  const theme = useThemeStore((s) => s.theme)

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const term = new Terminal({
      convertEol: true,
      scrollback: 5000,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      fontSize: 12,
      lineHeight: 1.4,
      theme: resolveTerminalTheme(theme),
      disableStdin: readOnly,
      screenReaderMode: true,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(container)

    const fitAndSync = () => {
      if (!container.clientWidth || !container.clientHeight) {
        return
      }
      fitAddon.fit()
      driver.resize(term.cols, term.rows)
    }

    if (isActive) {
      fitAndSync()
    }

    termRef.current = term
    fitAndSyncRef.current = fitAndSync

    const cached = outputCache.get(terminalId) ?? []
    for (const chunk of cached) {
      term.write(chunk)
    }

    const dataDisposable = readOnly
      ? null
      : term.onData((data) => {
          driver.write(data)
        })

    let unlistenOutput: (() => void) | null = null
    let unlistenExit: (() => void) | null = null
    let mounted = true
    let firstOutputSynced = false

    driver
      .onOutput((bytes) => {
        const cache = outputCache.get(terminalId) ?? []
        if (cache.length < MAX_CACHE_CHUNKS) {
          cache.push(bytes)
          outputCache.set(terminalId, cache)
        }
        if (mounted) {
          term.write(bytes)
          if (!firstOutputSynced) {
            firstOutputSynced = true
            fitAndSync()
          }
        }
      })
      .then((fn) => {
        if (mounted) {
          unlistenOutput = fn
        } else {
          fn()
        }
      })

    driver
      .onExit((exitCode) => {
        if (!mounted) {
          return
        }
        if (exitMessage) {
          term.writeln(exitMessage)
        }
        onExit?.(exitCode)
      })
      .then((fn) => {
        if (mounted) {
          unlistenExit = fn
        } else {
          fn()
        }
      })

    const ro = new ResizeObserver(() => {
      fitAndSync()
    })
    ro.observe(container)

    return () => {
      mounted = false
      dataDisposable?.dispose()
      unlistenOutput?.()
      unlistenExit?.()
      ro.disconnect()
      term.dispose()
      termRef.current = null
      fitAndSyncRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminalId])

  useEffect(() => {
    const term = termRef.current
    if (!term) {
      return
    }
    term.options.theme = resolveTerminalTheme(theme)
  }, [theme])

  useEffect(() => {
    if (isActive) {
      const id = requestAnimationFrame(() => {
        fitAndSyncRef.current?.()
        if (!readOnly) {
          termRef.current?.focus()
        }
      })
      return () => cancelAnimationFrame(id)
    }
  }, [isActive, readOnly])

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
          title="Restart shell"
          aria-label="Restart shell"
          className="absolute right-2 top-2 z-10 rounded-sm bg-background/80 p-1 text-muted-foreground backdrop-blur hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        >
          <RotateCcw size={12} aria-hidden />
        </button>
      ) : null}
    </div>
  )
}
