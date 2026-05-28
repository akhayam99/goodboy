import type { CSSProperties } from 'react';
import agentDebugger from '../assets/agents/debugger.png';
import agentDocs from '../assets/agents/docs.png';
import agentGoodboy from '../assets/agents/goodboy.png';
import agentImplementer from '../assets/agents/implementer.png';
import agentPlanner from '../assets/agents/planner.png';
import agentReviewer from '../assets/agents/reviewer.png';
import agentScout from '../assets/agents/scout.png';
import agentTester from '../assets/agents/tester.png';

export type AgentKind =
  | 'generic'
  | 'scout'
  | 'planner'
  | 'implementer'
  | 'debugger'
  | 'tester'
  | 'reviewer'
  | 'docs';

const KIND_IMAGE: Record<AgentKind, string> = {
  generic: agentGoodboy,
  scout: agentScout,
  planner: agentPlanner,
  implementer: agentImplementer,
  debugger: agentDebugger,
  tester: agentTester,
  reviewer: agentReviewer,
  docs: agentDocs,
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
};

export const KIND_LABEL: Record<AgentKind, string> = {
  generic: 'Agent',
  scout: 'Scout',
  planner: 'Plan',
  implementer: 'Implement',
  debugger: 'Debug',
  tester: 'Test',
  reviewer: 'Review',
  docs: 'Docs',
};

/** Mirror of apps/desktop/src/shared/components/AgentAvatar. Same PNG mask
 *  pipeline so the marketing surfaces use the same illustration set the
 *  product ships. */
export function AgentAvatar({
  kind,
  size = 16,
  tint,
  className,
}: {
  kind: AgentKind;
  size?: number;
  /** Override the default role tint (e.g. when sitting on a coloured chip). */
  tint?: string;
  className?: string;
}) {
  const image = KIND_IMAGE[kind];
  const tintClass = tint ?? KIND_TINT[kind];
  const style: CSSProperties = {
    width: size,
    height: size,
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
      className={['inline-block shrink-0', tintClass, className].filter(Boolean).join(' ')}
      style={style}
    />
  );
}
