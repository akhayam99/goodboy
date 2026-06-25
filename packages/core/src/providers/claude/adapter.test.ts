import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import type {
  IsoDateTime,
  ProviderRunId,
  SessionId,
  TurnEvent,
  TurnPermissionFlags,
  TurnRequest,
} from '@goodboy/types'
import { ClaudeAdapter } from './adapter'

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

function makeOpenChild(lines: ReadonlyArray<string>): OpenChild {
  return new OpenChild(lines)
}

function makeRequest(permissionFlags?: TurnPermissionFlags): TurnRequest {
  return {
    runId: 'run_1' as ProviderRunId,
    sessionId: 'sess_1' as SessionId,
    model: 'claude-opus-4-7',
    workingDir: '/tmp/demo',
    systemPrompt: 'sys',
    userMessage: 'hi',
    permissionFlags,
  }
}

describe('ClaudeAdapter.spawn', () => {
  it('emits parsed TurnEvents end-to-end', async () => {
    const lines = [
      JSON.stringify({ type: 'system', subtype: 'init' }),
      JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'text', text: 'hello' }] },
      }),
      JSON.stringify({
        type: 'result',
        subtype: 'success',
        usage: { input_tokens: 5, output_tokens: 3 },
      }),
    ]
    const child = new FakeChild(lines)
    const adapter = new ClaudeAdapter({
      now: fakeNow,
      spawnFn: (() => child) as never,
    })

    const collected: TurnEvent[] = []
    for await (const event of adapter.spawn(makeRequest())) {
      collected.push(event)
    }

    expect(collected.map((e) => e.kind)).toEqual(['assistant_text', 'usage', 'done'])
    expect(collected[0]).toMatchObject({ delta: 'hello' })
  })

  it('kills the child on early break', async () => {
    const child = makeOpenChild([
      JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'text', text: 'a' }] },
      }),
    ])
    const adapter = new ClaudeAdapter({
      now: fakeNow,
      spawnFn: (() => child) as never,
    })

    const iterator = adapter.spawn(makeRequest())[Symbol.asyncIterator]()
    const first = await iterator.next()
    expect(first.done).toBe(false)
    await iterator.return?.(undefined)
    expect(child.killed).toBe(true)
    expect(child.signal).toBe('SIGTERM')
  })
})

describe('ClaudeAdapter.detect', () => {
  it('returns available with parsed version on exit 0', async () => {
    const child = new FakeChild(['1.0.0'])
    const adapter = new ClaudeAdapter({
      now: fakeNow,
      spawnFn: (() => child) as never,
    })
    const result = await adapter.detect()
    expect(result.kind).toBe('available')
  })

  it('returns missing on spawn error', async () => {
    const child = new FakeChild([])
    queueMicrotask(() => child.emit('error', new Error('ENOENT')))
    const adapter = new ClaudeAdapter({
      now: fakeNow,
      spawnFn: (() => child) as never,
    })
    const result = await adapter.detect()
    expect(result.kind).toBe('missing')
  })
})

describe('spawnClaude, permission flags', () => {
  function captureArgs(permissionFlags?: TurnPermissionFlags): string[] {
    let capturedArgs: string[] = []
    const child = new FakeChild([])
    const spawnFn = (_binary: string, args: string[]) => {
      capturedArgs = args
      return child
    }
    const adapter = new ClaudeAdapter({
      now: fakeNow,
      spawnFn: spawnFn as never,
    })
    void (async () => {
      for await (const _ of adapter.spawn(makeRequest(permissionFlags))) {
        // drain
      }
    })()
    return capturedArgs
  }

  it('uses --permission-mode default and omits legacy bypass flag when no permissionFlags provided', () => {
    const args = captureArgs()
    expect(args).toContain('--permission-mode')
    expect(args[args.indexOf('--permission-mode') + 1]).toBe('default')
    expect(args).not.toContain('--dangerously-skip-permissions')
    expect(args).not.toContain('--allowedTools')
    expect(args).not.toContain('--disallowedTools')
  })

  it('passes bypassPermissions mode without legacy bypass flag', () => {
    const args = captureArgs({ mode: 'bypassPermissions' })
    expect(args[args.indexOf('--permission-mode') + 1]).toBe('bypassPermissions')
    expect(args).not.toContain('--dangerously-skip-permissions')
  })

  it('appends --allowedTools as comma-list when allowedTools non-empty', () => {
    const args = captureArgs({ mode: 'default', allowedTools: ['Edit', 'Read'] })
    expect(args).toContain('--allowedTools')
    expect(args[args.indexOf('--allowedTools') + 1]).toBe('Edit,Read')
    expect(args).not.toContain('--disallowedTools')
  })

  it('appends --disallowedTools as comma-list when disallowedTools non-empty', () => {
    const args = captureArgs({ mode: 'default', disallowedTools: ['Bash(rm:*)'] })
    expect(args).toContain('--disallowedTools')
    expect(args[args.indexOf('--disallowedTools') + 1]).toBe('Bash(rm:*)')
    expect(args).not.toContain('--allowedTools')
  })

  it('appends both tool lists when both provided', () => {
    const args = captureArgs({
      mode: 'plan',
      allowedTools: ['Read'],
      disallowedTools: ['Bash'],
    })
    expect(args[args.indexOf('--permission-mode') + 1]).toBe('plan')
    expect(args[args.indexOf('--allowedTools') + 1]).toBe('Read')
    expect(args[args.indexOf('--disallowedTools') + 1]).toBe('Bash')
  })
})
