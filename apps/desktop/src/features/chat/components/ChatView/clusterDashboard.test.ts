import type { Agent, AgentId, PlanWithCount, WorkflowRunId } from '@goodboy/types'
import { describe, expect, it } from 'vitest'
import { selectClusterDashboard, selectInlineClusterRuns } from './clusterDashboard'

const agent = (over: {
  id: string
  ordinal?: number
  parentAgentId?: string
  status?: Agent['status']
  kind?: string
  workflowRunId?: WorkflowRunId
}): Agent =>
  ({
    sessionId: 's1',
    ordinal: 0,
    name: over.id,
    status: 'pending',
    kind: 'implementer',
    ...over,
    id: over.id as AgentId,
    parentAgentId: over.parentAgentId as AgentId | undefined,
  }) as Agent

const plan = (over: Partial<PlanWithCount>): PlanWithCount =>
  ({
    id: 'p1',
    sessionId: 's1',
    agentId: 'a',
    title: 'goal',
    bodyMd: '',
    status: 'active',
    consumptionCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    clusters: [
      { title: 'c0', instructions: 'do 0' },
      { title: 'c1', instructions: 'do 1' },
    ],
    ...over,
  }) as PlanWithCount

const runs: ReadonlyArray<Agent> = [
  agent({ id: 'container', ordinal: 0 }),
  agent({ id: 'child0', parentAgentId: 'container', ordinal: 1, status: 'completed' }),
  agent({ id: 'child1', parentAgentId: 'container', ordinal: 2, status: 'running' }),
]

describe('selectClusterDashboard', () => {
  it('resolves dashboard when the container is selected', () => {
    const d = selectClusterDashboard(runs, 'container' as AgentId, [plan({})])
    expect(d?.containerId).toBe('container')
    expect(d?.total).toBe(2)
    expect(d?.completed).toBe(1)
    expect(d?.items.map((i) => i.agent.id)).toEqual(['child0', 'child1'])
  })

  it('resolves dashboard when a child is selected (via parentAgentId)', () => {
    const d = selectClusterDashboard(runs, 'child1' as AgentId, [plan({})])
    expect(d?.containerId).toBe('container')
    expect(d?.items).toHaveLength(2)
  })

  it('maps child index to plan cluster instructions', () => {
    const d = selectClusterDashboard(runs, 'container' as AgentId, [plan({})])
    expect(d?.items[0]?.instructions).toBe('do 0')
    expect(d?.items[1]?.instructions).toBe('do 1')
  })

  it('returns null when children are not implementers (scout fan-out)', () => {
    const scoutRuns: ReadonlyArray<Agent> = [
      agent({ id: 'container', ordinal: 0 }),
      agent({ id: 'c0', parentAgentId: 'container', ordinal: 1, kind: 'scout' }),
      agent({ id: 'c1', parentAgentId: 'container', ordinal: 2, kind: 'scout' }),
    ]
    expect(selectClusterDashboard(scoutRuns, 'container' as AgentId, [plan({})])).toBeNull()
  })

  it('returns null when no matching clusters plan exists', () => {
    expect(selectClusterDashboard(runs, 'container' as AgentId, [])).toBeNull()
  })

  it('still renders for a consumed plan with implementer children (display contract)', () => {
    const d = selectClusterDashboard(runs, 'container' as AgentId, [plan({ status: 'consumed' })])
    expect(d?.containerId).toBe('container')
    expect(d?.items).toHaveLength(2)
  })

  it('returns null when the selected agent has no cluster siblings', () => {
    const lone: ReadonlyArray<Agent> = [agent({ id: 'solo', ordinal: 0 })]
    expect(selectClusterDashboard(lone, 'solo' as AgentId, [plan({})])).toBeNull()
  })

  it('matches plans by workflowRunId', () => {
    const wfRuns: ReadonlyArray<Agent> = [
      agent({ id: 'container', ordinal: 0, workflowRunId: 'wf1' as WorkflowRunId }),
      agent({ id: 'child0', parentAgentId: 'container', ordinal: 1 }),
      agent({ id: 'child1', parentAgentId: 'container', ordinal: 2 }),
    ]
    const wfPlan = plan({ workflowRunId: 'wf1' as WorkflowRunId })
    expect(selectClusterDashboard(wfRuns, 'container' as AgentId, [wfPlan])?.total).toBe(2)
    expect(selectClusterDashboard(wfRuns, 'container' as AgentId, [plan({})])).toBeNull()
  })

  it('returns null when no agent is selected', () => {
    expect(selectClusterDashboard(runs, undefined, [plan({})])).toBeNull()
  })

  it('returns null when the selected agent is not in the run list', () => {
    expect(selectClusterDashboard(runs, 'ghost' as AgentId, [plan({})])).toBeNull()
  })

  it('returns null when only some children are implementers', () => {
    const mixed: ReadonlyArray<Agent> = [
      agent({ id: 'container', ordinal: 0 }),
      agent({ id: 'child0', parentAgentId: 'container', ordinal: 1 }),
      agent({ id: 'child1', parentAgentId: 'container', ordinal: 2, kind: 'scout' }),
    ]
    expect(selectClusterDashboard(mixed, 'container' as AgentId, [plan({})])).toBeNull()
  })

  it('returns null when the container has a single child (below the cluster threshold)', () => {
    const single: ReadonlyArray<Agent> = [
      agent({ id: 'container', ordinal: 0 }),
      agent({ id: 'child0', parentAgentId: 'container', ordinal: 1 }),
    ]
    expect(selectClusterDashboard(single, 'child0' as AgentId, [plan({})])).toBeNull()
  })

  it('yields null instructions for children beyond the plan cluster count', () => {
    const wider: ReadonlyArray<Agent> = [
      agent({ id: 'container', ordinal: 0 }),
      agent({ id: 'child0', parentAgentId: 'container', ordinal: 1 }),
      agent({ id: 'child1', parentAgentId: 'container', ordinal: 2 }),
      agent({ id: 'child2', parentAgentId: 'container', ordinal: 3 }),
    ]
    const d = selectClusterDashboard(wider, 'container' as AgentId, [plan({})])
    expect(d?.total).toBe(3)
    expect(d?.items[2]?.instructions).toBeNull()
  })

  it('reports completed as 0 when no child has completed', () => {
    const pending: ReadonlyArray<Agent> = [
      agent({ id: 'container', ordinal: 0 }),
      agent({ id: 'child0', parentAgentId: 'container', ordinal: 1, status: 'pending' }),
      agent({ id: 'child1', parentAgentId: 'container', ordinal: 2, status: 'running' }),
    ]
    expect(selectClusterDashboard(pending, 'container' as AgentId, [plan({})])?.completed).toBe(0)
  })

  it('reports completed equal to total when every child is completed', () => {
    const done: ReadonlyArray<Agent> = [
      agent({ id: 'container', ordinal: 0 }),
      agent({ id: 'child0', parentAgentId: 'container', ordinal: 1, status: 'completed' }),
      agent({ id: 'child1', parentAgentId: 'container', ordinal: 2, status: 'completed' }),
    ]
    const d = selectClusterDashboard(done, 'container' as AgentId, [plan({})])
    expect(d?.completed).toBe(2)
    expect(d?.total).toBe(2)
  })

  it('orders items by ordinal regardless of run array order', () => {
    const shuffled: ReadonlyArray<Agent> = [
      agent({ id: 'child1', parentAgentId: 'container', ordinal: 2 }),
      agent({ id: 'container', ordinal: 0 }),
      agent({ id: 'child0', parentAgentId: 'container', ordinal: 1 }),
    ]
    const d = selectClusterDashboard(shuffled, 'container' as AgentId, [plan({})])
    expect(d?.items.map((i) => i.agent.id)).toEqual(['child0', 'child1'])
  })

  it('tags each item with its zero-based index and the shared total', () => {
    const d = selectClusterDashboard(runs, 'container' as AgentId, [plan({})])
    expect(d?.items.map((i) => i.index)).toEqual([0, 1])
    expect(d?.items.every((i) => i.total === 2)).toBe(true)
  })
})

const defs = [
  { title: 'c0', instructions: 'do 0' },
  { title: 'c1', instructions: 'do 1' },
]

describe('selectInlineClusterRuns', () => {
  it('returns defs with null agents when no container is given (pre-spawn)', () => {
    const links = selectInlineClusterRuns(runs, null, defs)
    expect(links).toHaveLength(2)
    expect(links.every((l) => l.agent === null)).toBe(true)
    expect(links[0]?.title).toBe('c0')
  })

  it('joins each def to the container child at the same index', () => {
    const links = selectInlineClusterRuns(runs, 'container' as AgentId, defs)
    expect(links[0]?.agent?.id).toBe('child0')
    expect(links[1]?.agent?.id).toBe('child1')
  })

  it('orders children by ordinal regardless of run array order', () => {
    const shuffled: ReadonlyArray<Agent> = [
      agent({ id: 'child1', parentAgentId: 'container', ordinal: 2 }),
      agent({ id: 'container', ordinal: 0 }),
      agent({ id: 'child0', parentAgentId: 'container', ordinal: 1 }),
    ]
    const links = selectInlineClusterRuns(shuffled, 'container' as AgentId, defs)
    expect(links.map((l) => l.agent?.id)).toEqual(['child0', 'child1'])
  })

  it('leaves a def unmatched (null agent) when no child exists at its index', () => {
    const partial: ReadonlyArray<Agent> = [
      agent({ id: 'container', ordinal: 0 }),
      agent({ id: 'child0', parentAgentId: 'container', ordinal: 1 }),
      agent({ id: 'child1', parentAgentId: 'container', ordinal: 2 }),
    ]
    const links = selectInlineClusterRuns(partial, 'container' as AgentId, [
      ...defs,
      { title: 'c2', instructions: 'do 2' },
    ])
    expect(links[2]?.agent).toBeNull()
  })

  it('ignores non-implementer children when joining', () => {
    const scouts: ReadonlyArray<Agent> = [
      agent({ id: 'container', ordinal: 0 }),
      agent({ id: 's0', parentAgentId: 'container', ordinal: 1, kind: 'scout' }),
    ]
    const links = selectInlineClusterRuns(scouts, 'container' as AgentId, defs)
    expect(links.every((l) => l.agent === null)).toBe(true)
  })
})
