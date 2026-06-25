import type { CSSProperties } from 'react'
import { cn } from '@goodboy/ui'
import type { AgentKind } from '../../../features/session/agent-kind'
import agentDebugger from '../../../assets/agents/debugger.png'
import agentDocs from '../../../assets/agents/docs.png'
import agentGoodboy from '../../../assets/agents/goodboy.png'
import agentImplementer from '../../../assets/agents/implementer.png'
import agentPlanner from '../../../assets/agents/planner.png'
import agentReviewer from '../../../assets/agents/reviewer.png'
import agentScout from '../../../assets/agents/scout.png'
import agentTester from '../../../assets/agents/tester.png'

const KIND_IMAGE: Record<AgentKind, string | null> = {
  generic: agentGoodboy,
  scout: agentScout,
  planner: agentPlanner,
  implementer: agentImplementer,
  debugger: agentDebugger,
  tester: agentTester,
  reviewer: agentReviewer,
  docs: agentDocs,
  resolver: null,
}

// Per-agent identity colors as design tokens (oklch). Kept here rather than as
// raw bg-*-400 Tailwind literals so each kind has one semantic source of truth.
const KIND_COLOR: Record<AgentKind, string> = {
  generic: 'oklch(0.71 0.16 17)',
  scout: 'oklch(0.74 0.13 233)',
  planner: 'oklch(0.7 0.16 295)',
  implementer: 'oklch(0.76 0.15 158)',
  debugger: 'oklch(0.81 0.14 84)',
  tester: 'oklch(0.78 0.12 188)',
  reviewer: 'oklch(0.78 0.12 213)',
  docs: 'oklch(0.77 0.15 62)',
  resolver: 'oklch(0.82 0.18 130)',
}

const SIZE_CLASS: Record<AvatarSize, string> = {
  xs: 'size-3.5',
  sm: 'size-4',
  md: 'size-5',
  lg: 'size-6',
}

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg'

export type AgentVisual = {
  readonly image: string | null
  readonly color: string
}

/**
 * Resolve the shared identity visual (portrait + token color) for an agent kind.
 * Single source of truth for both the avatar dot and the empty-state hero.
 */
export const getAgentVisual = (kind: AgentKind): AgentVisual => ({
  image: KIND_IMAGE[kind],
  color: KIND_COLOR[kind],
})

type Props = {
  readonly kind: AgentKind
  readonly size?: AvatarSize
  readonly className?: string
  readonly title?: string
}

export const AgentAvatar = ({ kind, size = 'sm', className, title }: Props) => {
  const { image, color } = getAgentVisual(kind)

  if (!image) {
    return (
      <span
        aria-hidden
        title={title}
        className={cn('inline-block shrink-0 rounded-full', SIZE_CLASS[size], className)}
        style={{ backgroundColor: color }}
      />
    )
  }

  const style: CSSProperties = {
    backgroundColor: color,
    maskImage: `url(${image})`,
    maskRepeat: 'no-repeat',
    maskPosition: 'center',
    maskSize: 'contain',
    WebkitMaskImage: `url(${image})`,
    WebkitMaskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    WebkitMaskSize: 'contain',
  }

  return (
    <span
      aria-hidden
      title={title}
      className={cn('inline-block shrink-0', SIZE_CLASS[size], className)}
      style={style}
    />
  )
}
