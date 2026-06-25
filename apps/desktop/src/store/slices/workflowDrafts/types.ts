import type { WorkflowId } from '@goodboy/types'
import type { PlannerOutput } from '@goodboy/core'
import type { EffortLevel } from '../../../features/chat/utils/chat-constants'

export type { SetFn, GetFn } from '../../slice-types'

export type Mode = 'preset' | 'custom'

export type StepEdit = {
  readonly name?: string
  readonly promptPrefix?: string
  readonly model?: string
  readonly effort?: EffortLevel
  readonly dirty?: boolean
}

export type WorkflowBuilderDraft = {
  readonly mode: Mode
  readonly goalText: string
  readonly goalHistory: ReadonlyArray<string>
  readonly selectedPresetId: WorkflowId | null
  readonly processText: string
  readonly plan: PlannerOutput | null
  readonly stepEdits: Record<number, StepEdit>
  readonly saveAsPreset: boolean
  readonly autoRun: boolean
}
