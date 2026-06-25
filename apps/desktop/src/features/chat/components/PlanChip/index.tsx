import { useMemo } from 'react'
import { FileText } from 'lucide-react'
import type { SessionId } from '@goodboy/types'
import { extractPlanFromMarker } from '@goodboy/core'
import { useSessionPlans } from '../../../../store'
import { MARKER_ACCENT } from '../marker-accents'

type Props = {
  readonly assistantText: string
  readonly sessionId: SessionId
}

const accent = MARKER_ACCENT.plan

export const PlanChip = ({ assistantText, sessionId }: Props) => {
  const plan = useMemo(() => extractPlanFromMarker(assistantText), [assistantText])
  const plans = useSessionPlans(sessionId)

  if (!plan) {
    return null
  }

  const resolved = plans.find((p) => p.title === plan.title) ?? plans[plans.length - 1] ?? null

  const onClick = () => {
    window.dispatchEvent(
      new CustomEvent('goodboy:open-plan-studio', {
        detail: { sessionId, ...(resolved ? { planId: resolved.id } : {}) },
      }),
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="plan-chip"
      className={`inline-flex w-fit items-center gap-1.5 rounded-full border ${accent.border} ${accent.bg} px-2.5 py-1 text-[11px] font-medium ${accent.text} hover:opacity-80`}
    >
      <FileText size={11} aria-hidden />
      <span>{plan.title}</span>
    </button>
  )
}
