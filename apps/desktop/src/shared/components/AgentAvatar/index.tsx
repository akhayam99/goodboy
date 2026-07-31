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
  'pr-reviewer': agentReviewer,
  docs: agentDocs,
  resolver: null,
};

const KIND_COLOR: Record<AgentKind, string> = {
  generic: 'var(--color-agent-generic)',
  scout: 'var(--color-agent-scout)',
  planner: 'var(--color-agent-planner)',
  implementer: 'var(--color-agent-implementer)',
  debugger: 'var(--color-agent-debugger)',
  tester: 'var(--color-agent-tester)',
  reviewer: 'var(--color-agent-reviewer)',
  'pr-reviewer': 'var(--color-agent-pr-reviewer)',
  docs: 'var(--color-agent-docs)',
  resolver: 'var(--color-agent-resolver)',
};

const SIZE_CLASS: Record<AvatarSize, string> = {
  xs: 'size-3.5',
  sm: 'size-4',
  md: 'size-5',
  lg: 'size-6',
};

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';

export type AgentVisual = {
  readonly image: string | null;
  readonly color: string;
};

export const getAgentVisual = (kind: AgentKind): AgentVisual => ({
  image: KIND_IMAGE[kind],
  color: KIND_COLOR[kind],
});

type Props = {
  readonly kind: AgentKind;
  readonly size?: AvatarSize;
  readonly className?: string;
  readonly title?: string;
};

export const AgentAvatar = ({ kind, size = 'sm', className, title }: Props) => {
  const { image, color } = getAgentVisual(kind);

  if (!image) {
    return (
      <span
        aria-hidden
        title={title}
        className={cn('inline-block shrink-0 rounded-full', SIZE_CLASS[size], className)}
        style={{ backgroundColor: color }}
      />
    );
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
  };

  return (
    <span
      aria-hidden
      title={title}
      className={cn('inline-block shrink-0', SIZE_CLASS[size], className)}
      style={style}
    />
  );
};
