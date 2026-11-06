import { cn, tintClasses } from '@goodboy/ui';
import type { Agent, SessionId } from '@goodboy/types';
import type { GlanceState } from '../../../session/glance/glanceOf';
import { useConversationAsks } from '../../../../store/hooks/useConversationAsks';
import { useConversationGlance } from '../../../../store/hooks/useConversationGlance';
import { useStoppedAnswer } from '../../../../store/hooks/useStoppedAnswer';

type Props = {
  readonly sessionId: SessionId;
  readonly agent: Agent;
};

const SAID_ELSEWHERE: ReadonlySet<GlanceState> = new Set<GlanceState>([
  'working',
  'planning',
  'stopped',
]);

export const AgentDockLine = ({ sessionId, agent }: Props) => {
  const glance = useConversationGlance({ sessionId, agent, autoView: null });
  const { permissions, questions } = useConversationAsks({ sessionId, agentId: agent.id });
  const stopped = useStoppedAnswer({ agentId: agent.id });
  const hasAsk = permissions.length > 0 || questions.length > 0;
  if (hasAsk || stopped !== null || glance.sentence === '' || SAID_ELSEWHERE.has(glance.state)) {
    return null;
  }
  return (
    <div
      data-dock-row=""
      data-dock-line={glance.state}
      data-dock-word={glance.word}
      className="flex min-h-7 min-w-0 items-center gap-2 text-ui"
    >
      <span
        aria-hidden="true"
        className={cn('inline-block size-1.5 shrink-0 rounded-full', tintClasses(glance.tone).dot)}
      />
      <span role="status" aria-live="polite" className="min-w-0 truncate text-foreground">
        {glance.sentence}
      </span>
    </div>
  );
};
