import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import type { IsoDateTime, ProviderRunId, TurnEvent } from '@goodboy/types'
import { streamChildEvents } from './stream-events'
import type { ParseContext } from './anthropic-envelope-parser'

const fakeNow = (): IsoDateTime => '2026-05-13T00:00:00.000Z' as IsoDateTime
const RUN_ID = 'run_stream' as ProviderRunId

const ctx: ParseContext = { runId: RUN_ID, now: fakeNow }

const parseLine = (line: string, c: ParseContext): ReadonlyArray<TurnEvent> => {
  const trimmed = line.trim()
  if (trimmed.length === 0) {
    return []
  }
  return [{ kind: 'assistant_text', runId: c.runId, delta: trimmed, at: c.now() }]
}

const doneEvent = (c: ParseContext): TurnEvent => ({ kind: 'done', runId: c.runId, at: c.now() })

class FakeChild extends EventEmitter {
  stdout: Readable
  stderr: Readable
  exitCode: number | null = null
  killed = false
  signal: NodeJS.Signals | null = null

  constructor(lines: ReadonlyArray<string>, exit = 0) {
    super()
    this.stdout = Readable.from(lines.map((line) => `${line}\n`))
    this.stderr = Readable.from([])
    queueMicrotask(() => {
      this.exitCode = exit
      this.stdout.on('end', () => this.emit('close', exit))
    })
  }

  kill(signal: NodeJS.Signals = 'SIGTERM'): boolean {
    this.killed = true
    this.signal = signal
    this.exitCode = 143
    return true
  }
}

class OpenChild extends EventEmitter {
  stdout: Readable
  stderr: Readable
  exitCode: number | null = null
  killed = false
  signal: NodeJS.Signals | null = null

  constructor(lines: ReadonlyArray<string>) {
    super()
    this.stdout = new Readable({ read() {} })
    for (const line of lines) this.stdout.push(`${line}\n`)
    this.stderr = new Readable({ read() {} })
  }

  kill(signal: NodeJS.Signals = 'SIGTERM'): boolean {
    this.killed = true
    this.signal = signal
    this.exitCode = 143
    return true
  }
}

async function collect(iterable: AsyncIterable<TurnEvent>): Promise<TurnEvent[]> {
  const events: TurnEvent[] = []
  for await (const event of iterable) {
    events.push(event)
  }
  return events
}

describe('streamChildEvents', () => {
  it('maps each stdout line to parsed turn events in order', async () => {
    const child = new FakeChild(['alpha', 'beta', 'gamma'])
    const events = await collect(streamChildEvents(child as never, ctx, parseLine))
    expect(events.map((e) => e.kind)).toEqual([
      'assistant_text',
      'assistant_text',
      'assistant_text',
    ])
    expect(events.map((e) => (e.kind === 'assistant_text' ? e.delta : null))).toEqual([
      'alpha',
      'beta',
      'gamma',
    ])
  })

  it('skips lines that parse to no events', async () => {
    const child = new FakeChild(['alpha', '', '   ', 'beta'])
    const events = await collect(streamChildEvents(child as never, ctx, parseLine))
    expect(events.map((e) => (e.kind === 'assistant_text' ? e.delta : null))).toEqual([
      'alpha',
      'beta',
    ])
  })

  it('appends synthetic onClose events after stream end (codex/gemini done path)', async () => {
    const child = new FakeChild(['alpha'])
    const events = await collect(
      streamChildEvents(child as never, ctx, parseLine, { onClose: () => [doneEvent(ctx)] }),
    )
    expect(events.map((e) => e.kind)).toEqual(['assistant_text', 'done'])
    expect(events[events.length - 1]).toMatchObject({ kind: 'done', runId: RUN_ID })
  })

  it('emits onClose events even when no lines were produced', async () => {
    const child = new FakeChild([])
    const events = await collect(
      streamChildEvents(child as never, ctx, parseLine, { onClose: () => [doneEvent(ctx)] }),
    )
    expect(events.map((e) => e.kind)).toEqual(['done'])
  })

  it('throws when the child process emits error', async () => {
    const child = new FakeChild([], 1)
    queueMicrotask(() => child.emit('error', new Error('ENOENT stream')))
    await expect(collect(streamChildEvents(child as never, ctx, parseLine))).rejects.toThrow(
      'ENOENT stream',
    )
  })

  it('kills the child on early break', async () => {
    const child = new OpenChild(['alpha'])
    const iterator = streamChildEvents(child as never, ctx, parseLine)[Symbol.asyncIterator]()
    const first = await iterator.next()
    expect(first.done).toBe(false)
    await iterator.return?.(undefined)
    expect(child.killed).toBe(true)
    expect(child.signal).toBe('SIGTERM')
  })
})
