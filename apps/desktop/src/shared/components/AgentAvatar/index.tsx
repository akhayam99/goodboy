import type { CSSProperties } from 'react';
import { cn } from '@goodboy/ui';
import type { AgentKind } from '../../../features/session/agent-kind';
import agentDebugger from '../../../assets/agents/debugger.png';
import agentDocs from '../../../assets/agents/docs.png';
import agentGoodboy from '../../../assets/agents/goodboy.png';
import agentImplementer from '../../../assets/agents/implementer.png';
import agentPlanner from '../../../assets/agents/planner.png';
import agentReviewer from '../../../assets/agents/reviewer.png';
import agentScout from '../../../assets/agents/scout.png';
import agentTester from '../../../assets/agents/tester.png';

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
};

const KIND_TINT: Record<AgentKind, string> = {
  generic: 'bg-rose-400',
  scout: 'bg-sky-400',
  planner: 'bg-violet-400',
  implementer: 'bg-emerald-400',
  debugger: 'bg-amber-400',
  tester: 'bg-teal-400',
  reviewer: 'bg-cyan-400',
  docs: 'bg-orange-400',
  resolver: 'bg-lime-400',
};

const SIZE_CLASS: Record<AvatarSize, string> = {
  xs: 'size-3.5',
  sm: 'size-4',
  md: 'size-5',
  lg: 'size-6',
};

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';

type Props = {
  readonly kind: AgentKind;
  readonly size?: AvatarSize;
  readonly className?: string;
  readonly title?: string;
};

/**
 * Tiny dog silhouette in the role tint colour. Drop-in replacement for the
 * coloured-dot pattern (size-1.5 rounded-full bg-{kind}-400) used to mark an
 * agent kind. Falls back to a plain dot for the resolver kind (no portrait).
 */
export function AgentAvatar({ kind, size = 'sm', className, title }: Props) {
  const image = KIND_IMAGE[kind];
  const tint = KIND_TINT[kind];

  if (!image) {
    return (
      <span
        aria-hidden
        title={title}
        className={cn('inline-block shrink-0 rounded-full', SIZE_CLASS[size], tint, className)}
      />
    );
  }

  const style: CSSProperties = {
    maskImage: `url(${image})`,
    maskRepeat: 'no-repeat',
    maskPosition: 'center',
    maskSize: 'contain',
    WebkitMaskImage: `url(${image})`,
    WebkitMaskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    WebkitMaskSize: 'contain',
  };

  return (
    <span
      aria-hidden
      title={title}
      className={cn('inline-block shrink-0', SIZE_CLASS[size], tint, className)}
      style={style}
    />
  );
}
