import { cn } from '@goodboy/ui'
import type { Session } from '@goodboy/types'
import { useSessionStageInfo } from '../../../store'
import { SESSION_STAGE_META } from '../session-stage'

type Props = {
  readonly session: Session
}

export const SessionStageBadge = ({ session }: Props) => {
  const { stage, reason } = useSessionStageInfo(session)
  const meta = SESSION_STAGE_META[stage]
  return (
    <span
      role="status"
      title={reason ?? meta.label}
      aria-label={meta.label}
      className={cn(
        'inline-block size-2 shrink-0 rounded-full',
        meta.dotClassName,
        stage === 'running' && 'motion-safe:animate-pulse',
      )}
    />
  )
}
