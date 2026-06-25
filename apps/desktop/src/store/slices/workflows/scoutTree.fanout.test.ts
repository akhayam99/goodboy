import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Agent, AgentId, SessionId, WorkflowRunId } from '@goodboy/types'
import type { GetFn, SetFn } from './types'

const hoisted = vi.hoisted(() => {
  const insertArgs: Array<Record<string, unknown>> = []
  return {
    insertArgs,
    invokeAgentInsert: vi.fn(async (args: Record<string, unknown>) => {
      insertArgs.push(args)
      return { id: `child-${insertArgs.length}` as AgentId, ...args } as unknown as Agent
    }),
    invokeAgentList: vi.fn(async () => [] as Agent[]),
    invokeAgentUpdateStatus: vi.fn(async () => undefined),
  }
})

vi.mock('../../../features/workflows/workflows', () => ({
  invokeAgentInsert: hoisted.invokeAgentInsert,
  invokeAgentList: hoisted.invokeAgentList,
  invokeAgentUpdateStatus: hoisted.invokeAgentUpdateStatus,
}))

import { SCOUT_MAX_CHILDREN, fanOutScouts } from './scoutTree'

const SID = 'sess-1' as SessionId

const container = (over: Partial<Agent> = {}): Agent => ({
  id: 'container' as AgentId,
  sessionId: SID,
  ordinal: 0,
  name: 'root scout',
  status: 'running',
  kind: 'scout',
  ...over,
})

const areas = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ area: `area-${i}`, query: `q-${i}` }))

function makeStore(c: Agent) {
  const sendTurn = vi.fn(async () => undefined)
  const emitNotification = vi.fn(async () => undefined)
  const state: Record<string, unknown> = {
    sessionPhaseRuns: { [SID]: [c] },
    agentModelOverride: {},
    agentKindOverride: {},
    transcripts: {},
    agentTurnState: {},
    sessions: [],
    sendTurn,
    emitNotification,
  }
  const get = (() => state) as unknown as GetFn
  const set = ((u: unknown) => {
    const patch =
      typeof u === 'function'
        ? (u as (s: Record<string, unknown>) => Record<string, unknown>)(state)
        : (u as Record<string, unknown>)
    Object.assign(state, patch)
  }) as unknown as SetFn
  return { state, get, set, sendTurn, emitNotification }
}

afterEach(() => {
  hoisted.insertArgs.length = 0
  vi.clearAllMocks()
})

describe('fanOutScouts workflowRunId propagation', () => {
  it('propagates the container workflowRunId to every spawned sub-scout', async () => {
    const c = container({ workflowRunId: 'wf-1' as WorkflowRunId })
    const { get, set } = makeStore(c)

    await fanOutScouts(set, get, SID, c, areas(3))

    expect(hoisted.insertArgs).toHaveLength(3)
    for (const args of hoisted.insertArgs) {
      expect(args.workflowRunId).toBe('wf-1')
    }
  })

  it('omits workflowRunId for an ad-hoc scout container that has none', async () => {
    const c = container()
    const { get, set } = makeStore(c)

    await fanOutScouts(set, get, SID, c, areas(2))

    expect(hoisted.insertArgs).toHaveLength(2)
    for (const args of hoisted.insertArgs) {
      expect(args.workflowRunId).toBeUndefined()
    }
  })

  it('spawns children as scouts parented to the container in this session', async () => {
    const c = container({ workflowRunId: 'wf-1' as WorkflowRunId })
    const { get, set } = makeStore(c)

    await fanOutScouts(set, get, SID, c, areas(2))

    for (const args of hoisted.insertArgs) {
      expect(args.kind).toBe('scout')
      expect(args.parentAgentId).toBe('container')
      expect(args.sessionId).toBe(SID)
    }
  })

  it('kicks off a turn for each spawned sub-scout', async () => {
    const c = container({ workflowRunId: 'wf-1' as WorkflowRunId })
    const { get, set, sendTurn } = makeStore(c)

    await fanOutScouts(set, get, SID, c, areas(3))

    expect(sendTurn).toHaveBeenCalledTimes(3)
  })

  it('does not fan out (no inserts, no status flip) for fewer than 2 areas', async () => {
    const c = container({ workflowRunId: 'wf-1' as WorkflowRunId })
    const { get, set } = makeStore(c)

    await fanOutScouts(set, get, SID, c, areas(1))

    expect(hoisted.insertArgs).toHaveLength(0)
    expect(hoisted.invokeAgentUpdateStatus).not.toHaveBeenCalled()
  })

  it('caps fan-out at SCOUT_MAX_CHILDREN, still propagating workflowRunId, and notifies on drop', async () => {
    const c = container({ workflowRunId: 'wf-9' as WorkflowRunId })
    const { get, set, emitNotification } = makeStore(c)

    await fanOutScouts(set, get, SID, c, areas(SCOUT_MAX_CHILDREN + 2))

    expect(hoisted.insertArgs).toHaveLength(SCOUT_MAX_CHILDREN)
    for (const args of hoisted.insertArgs) {
      expect(args.workflowRunId).toBe('wf-9')
    }
    expect(emitNotification).toHaveBeenCalled()
  })
})
