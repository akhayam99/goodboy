import type { Agent, OpenQuestion, SessionStageInfo } from '@goodboy/types'

export type AttentionSummary = {
  readonly active: boolean
  readonly reason: string
}

export const isStandaloneAgent = (agent: Agent): boolean =>
  agent.parentAgentId == null && !(agent.workflowRunId != null && agent.stepId != null)

export const selectStandaloneAgents = (agents: ReadonlyArray<Agent>): ReadonlyArray<Agent> =>
  agents.filter(isStandaloneAgent)

export const selectAttention = (stage: SessionStageInfo): AttentionSummary => ({
  active: stage.stage === 'attention',
  reason: stage.reason,
})

export type AttentionLens = 'agents' | 'workflows' | 'questions' | 'pr'

export const resolveAttentionLens = (
  stage: SessionStageInfo,
  ctx: { readonly hasStandalone: boolean; readonly hasWorkflow: boolean },
): AttentionLens | null => {
  if (stage.stage !== 'attention') return null
  if (stage.reason.startsWith('PR')) return 'pr'
  if (stage.reason.includes('question')) return 'questions'
  if (ctx.hasStandalone) return 'agents'
  if (ctx.hasWorkflow) return 'workflows'
  return 'agents'
}

export const selectOpenQuestions = (
  questions: ReadonlyArray<OpenQuestion>,
): ReadonlyArray<OpenQuestion> => questions.filter((q) => q.status === 'open')
