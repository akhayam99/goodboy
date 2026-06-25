import type { Agent, AgentId, PlanWithCount } from '@goodboy/types'
import { selectClustersPlan } from '../../../../store/slices/workflows/clusterImplementation'

export type ClusterDashboardItem = Readonly<{
  agent: Agent
  index: number
  total: number
  instructions: string | null
}>

export type ClusterDashboard = Readonly<{
  containerId: AgentId
  completed: number
  total: number
  items: ReadonlyArray<ClusterDashboardItem>
}>

export type InlineClusterLink = Readonly<{
  title: string
  instructions: string
  agent: Agent | null
}>

export const selectInlineClusterRuns = (
  phaseRuns: ReadonlyArray<Agent>,
  containerId: AgentId | null,
  defs: ReadonlyArray<{ readonly title: string; readonly instructions: string }>,
): ReadonlyArray<InlineClusterLink> => {
  if (!containerId) {
    return defs.map((d) => ({ title: d.title, instructions: d.instructions, agent: null }))
  }
  const children = phaseRuns
    .filter((r) => r.parentAgentId === containerId && r.kind === 'implementer')
    .sort((a, b) => a.ordinal - b.ordinal)
  return defs.map((d, i) => ({
    title: d.title,
    instructions: d.instructions,
    agent: children[i] ?? null,
  }))
}

const childrenOf = (runs: ReadonlyArray<Agent>, containerId: AgentId): ReadonlyArray<Agent> =>
  runs.filter((r) => r.parentAgentId === containerId).sort((a, b) => a.ordinal - b.ordinal)

export const selectClusterDashboard = (
  phaseRuns: ReadonlyArray<Agent>,
  selectedAgentId: AgentId | undefined,
  plans: ReadonlyArray<PlanWithCount>,
): ClusterDashboard | null => {
  if (!selectedAgentId) {
    return null
  }
  const selected = phaseRuns.find((r) => r.id === selectedAgentId)
  if (!selected) {
    return null
  }

  let containerId: AgentId | null = null
  if (childrenOf(phaseRuns, selected.id).length >= 2) {
    containerId = selected.id
  } else if (selected.parentAgentId && childrenOf(phaseRuns, selected.parentAgentId).length >= 2) {
    containerId = selected.parentAgentId
  }
  if (!containerId) {
    return null
  }

  const container = phaseRuns.find((r) => r.id === containerId)
  if (!container) {
    return null
  }

  const children = childrenOf(phaseRuns, containerId)
  if (!children.every((c) => c.kind === 'implementer')) {
    return null
  }

  const plan = selectClustersPlan(plans, container.workflowRunId)
  if (!plan) {
    return null
  }

  const total = children.length
  const items: ReadonlyArray<ClusterDashboardItem> = children.map((agent, index) => ({
    agent,
    index,
    total,
    instructions: plan.clusters?.[index]?.instructions ?? null,
  }))
  const completed = children.filter((c) => c.status === 'completed').length

  return { containerId, completed, total, items }
}
