import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import { describe, expect, it, vi } from 'vitest'
import type { IsoDateTime, ProviderRunId, SessionId, TurnEvent, TurnRequest } from '@goodboy/types'
import { CursorAdapter } from './adapter'

const fakeNow = (): IsoDateTime => '2026-05-07T00:00:00.000Z' as IsoDateTime

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

function makeRequest(): TurnRequest {
  return {
    runId: 'run_1' as ProviderRunId,
    sessionId: 'sess_1' as SessionId,
    model: 'cursor-small',
    workingDir: '/tmp/demo',
    systemPrompt: 'sys',
    userMessage: 'hi',
  }
}

const FIXTURES = {
  init: JSON.stringify({ type: 'system', subtype: 'init' }),
  assistantText: JSON.stringify({
    type: 'assistant',
    message: { content: [{ type: 'text', text: 'hello world' }] },
  }),
  toolUseBash: JSON.stringify({
    type: 'assistant',
    message: {
      content: [{ type: 'tool_use', id: 'tool_a', name: 'Bash', input: { command: 'ls' } }],
    },
  }),
  toolUseWrite: JSON.stringify({
    type: 'assistant',
    message: {
      content: [
        {
          type: 'tool_use',
          id: 'tool_b',
          name: 'Write',
          input: { file_path: '/tmp/x.ts', content: 'export {};' },
        },
      ],
    },
  }),
  toolResult: JSON.stringify({
    type: 'user',
    message: {
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'tool_a',
          content: 'file1\nfile2',
          is_error: false,
        },
      ],
    },
  }),
  resultSuccess: JSON.stringify({
    type: 'result',
    subtype: 'success',
    usage: { input_tokens: 12, output_tokens: 7, cache_read_input_tokens: 3 },
  }),
  resultError: JSON.stringify({ type: 'result', subtype: 'error', error: 'rate limit' }),
}

async function collect(adapter: CursorAdapter): Promise<ReadonlyArray<TurnEvent>> {
  const events: TurnEvent[] = []
  for await (const event of adapter.spawn(makeRequest())) {
    events.push(event)
  }
  return events
}

describe('CursorAdapter, text stream', () => {
  it('emits assistant_text, usage, done for a basic text turn', async () => {
    const lines = [FIXTURES.init, FIXTURES.assistantText, FIXTURES.resultSuccess]
    const child = new FakeChild(lines)
    const adapter = new CursorAdapter({ now: fakeNow, spawnFn: (() => child) as never })

    const events = await collect(adapter)
    expect(events.map((e) => e.kind)).toEqual(['assistant_text', 'usage', 'done'])
    expect(events[0]).toMatchObject({ delta: 'hello world' })
  })
})

describe('CursorAdapter, tool use', () => {
  it('emits tool_call_start + tool_call_end for a bash tool round-trip', async () => {
    const lines = [FIXTURES.init, FIXTURES.toolUseBash, FIXTURES.toolResult, FIXTURES.resultSuccess]
    const child = new FakeChild(lines)
    const adapter = new CursorAdapter({ now: fakeNow, spawnFn: (() => child) as never })

    const events = await collect(adapter)
    expect(events.map((e) => e.kind)).toEqual(['tool_call_start', 'tool_call_end', 'usage', 'done'])
    expect(events[0]).toMatchObject({ toolName: 'Bash' })
    expect(events[1]).toMatchObject({ toolUseId: 'tool_a', isError: false })
  })

  it('emits file_edit alongside tool_call_start for Write tool', async () => {
    const child = new FakeChild([FIXTURES.toolUseWrite, FIXTURES.resultSuccess])
    const adapter = new CursorAdapter({ now: fakeNow, spawnFn: (() => child) as never })
    const events = await collect(adapter)
    const fileEdit = events.find((e) => e.kind === 'file_edit')
    expect(fileEdit).toMatchObject({ path: '/tmp/x.ts', editType: 'create' })
  })
})

describe('CursorAdapter, usage', () => {
  it('maps input/output/cached token fields into ProviderUsage', async () => {
    const child = new FakeChild([FIXTURES.resultSuccess])
    const adapter = new CursorAdapter({ now: fakeNow, spawnFn: (() => child) as never })
    const events = await collect(adapter)
    const usage = events.find((e) => e.kind === 'usage')
    expect(usage).toMatchObject({
      kind: 'usage',
      usage: { inputTokens: 12, outputTokens: 7, cachedInputTokens: 3 },
    })
  })
})

describe('CursorAdapter, malformed JSON', () => {
  it('tolerates malformed lines without crashing the stream', async () => {
    const lines = ['this is not json', '{ broken', FIXTURES.assistantText, FIXTURES.resultSuccess]
    const child = new FakeChild(lines)
    const adapter = new CursorAdapter({ now: fakeNow, spawnFn: (() => child) as never })
    const events = await collect(adapter)
    expect(events.map((e) => e.kind)).toEqual(['assistant_text', 'usage', 'done'])
  })

  it('emits unknown_payload event and invokes onUnknown for unrecognised payload types', async () => {
    const onUnknown = vi.fn()
    const lines = [
      FIXTURES.assistantText,
      JSON.stringify({ type: 'mystery_event', payload: { x: 1 } }),
      FIXTURES.resultSuccess,
    ]
    const child = new FakeChild(lines)
    const adapter = new CursorAdapter({
      now: fakeNow,
      spawnFn: (() => child) as never,
      onUnknown,
    })
    const events = await collect(adapter)
    expect(events.map((e) => e.kind)).toEqual([
      'assistant_text',
      'unknown_payload',
      'usage',
      'done',
    ])
    expect(events[1]).toMatchObject({
      kind: 'unknown_payload',
      adapter: 'cursor',
      payloadType: 'mystery_event',
    })
    expect(onUnknown).toHaveBeenCalledWith(
      'mystery_event',
      expect.objectContaining({ type: 'mystery_event' }),
    )
  })
})

describe('CursorAdapter, non-zero exit', () => {
  it('emits an error event when result subtype is error', async () => {
    const child = new FakeChild([FIXTURES.assistantText, FIXTURES.resultError])
    const adapter = new CursorAdapter({ now: fakeNow, spawnFn: (() => child) as never })
    const events = await collect(adapter)
    const errorEvent = events.find((e) => e.kind === 'error')
    expect(errorEvent).toMatchObject({ kind: 'error', message: 'rate limit' })
  })

  it('propagates spawn ENOENT as a thrown error', async () => {
    const child = new FakeChild([])
    queueMicrotask(() => child.emit('error', new Error('ENOENT: cursor-agent not found')))
    const adapter = new CursorAdapter({ now: fakeNow, spawnFn: (() => child) as never })
    await expect(collect(adapter)).rejects.toThrow('ENOENT')
  })

  it('kills the child on early break', async () => {
    const child = new OpenChild([
      JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'text', text: 'a' }] },
      }),
    ])
    const adapter = new CursorAdapter({ now: fakeNow, spawnFn: (() => child) as never })
    const iterator = adapter.spawn(makeRequest())[Symbol.asyncIterator]()
    const first = await iterator.next()
    expect(first.done).toBe(false)
    await iterator.return?.(undefined)
    expect(child.killed).toBe(true)
    expect(child.signal).toBe('SIGTERM')
  })
})

describe('CursorAdapter.detect', () => {
  it('returns available with parsed version on exit 0', async () => {
    const child = new FakeChild(['1.0.0'])
    const adapter = new CursorAdapter({ now: fakeNow, spawnFn: (() => child) as never })
    const result = await adapter.detect()
    expect(result.kind).toBe('available')
  })

  it('returns missing on spawn error', async () => {
    const child = new FakeChild([])
    queueMicrotask(() => child.emit('error', new Error('ENOENT')))
    const adapter = new CursorAdapter({ now: fakeNow, spawnFn: (() => child) as never })
    const result = await adapter.detect()
    expect(result.kind).toBe('missing')
  })
})
