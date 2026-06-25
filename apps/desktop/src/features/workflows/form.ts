import type {
  AgentRole,
  StepDef,
  StepDefId,
  StepId,
  VerbosityLevel,
  Workflow,
} from '@goodboy/types'
import { inferAgentKindFromName, KIND_TO_ROLE } from '../session/agent-kind'
import { type EffortLevel } from '../chat/utils/chat-constants'

export type DefinitionForm = {
  uid: string
  id?: StepId
  libraryStepId?: StepDefId
  role: AgentRole
  name: string
  promptPrefix: string
  providerOverride: string
  modelOverride: string
  effort: EffortLevel
  verbosity: VerbosityLevel
}

export type TemplateForm = {
  name: string
  description: string
  goal: string
  steps: DefinitionForm[]
}

const DEFAULT_EFFORT: EffortLevel = 'medium'
const DEFAULT_VERBOSITY: VerbosityLevel = 'normal'

let uidSeq = 0
const nextUid = (): string => {
  uidSeq += 1
  return `step-${Date.now().toString(36)}-${uidSeq.toString(36)}`
}

export const emptyDefinition = (): DefinitionForm => ({
  uid: nextUid(),
  role: 'custom',
  name: '',
  promptPrefix: '',
  providerOverride: '',
  modelOverride: '',
  effort: DEFAULT_EFFORT,
  verbosity: DEFAULT_VERBOSITY,
})

export const emptyForm = (): TemplateForm => ({
  name: '',
  description: '',
  goal: '',
  steps: [emptyDefinition()],
})

export const templateToForm = (t: Workflow): TemplateForm => {
  return {
    name: t.name,
    description: t.description,
    goal: t.goal ?? '',
    steps: t.steps
      .slice()
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((d) => ({
        uid: nextUid(),
        id: d.id,
        ...(d.libraryStepId !== undefined ? { libraryStepId: d.libraryStepId } : {}),
        role: d.role ?? KIND_TO_ROLE[inferAgentKindFromName(d.name)],
        name: d.name,
        promptPrefix: d.promptPrefix,
        providerOverride: d.providerOverride ?? '',
        modelOverride: d.modelOverride ?? '',
        effort: (d.effort as EffortLevel | undefined) ?? DEFAULT_EFFORT,
        verbosity: d.verbosity ?? DEFAULT_VERBOSITY,
      })),
  }
}

export const defFromLibraryStep = (s: StepDef): DefinitionForm => {
  return {
    uid: nextUid(),
    libraryStepId: s.id,
    role: s.role,
    name: s.name,
    promptPrefix: s.promptPrefix,
    providerOverride: s.providerDefault ?? '',
    modelOverride: s.modelDefault ?? '',
    effort: (s.effortDefault as EffortLevel | undefined) ?? DEFAULT_EFFORT,
    verbosity: s.verbosityDefault ?? DEFAULT_VERBOSITY,
  }
}
