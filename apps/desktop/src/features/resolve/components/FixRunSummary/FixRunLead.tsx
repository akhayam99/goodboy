import { ScrollFade } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';
import { useResolverBrief } from '../../hooks/useResolverBrief';
import { FixRunSummary } from '.';

type Props = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

export const FixRunLead = ({ sessionId, agentId }: Props) => {
  const session = useAppStore((s) => sessionById(s.sessions, sessionId) ?? null);
  const agent = useAppStore(
    (s) => (s.sessionPhaseRuns[sessionId] ?? []).find((run) => run.id === agentId) ?? null,
  );
  const brief = useResolverBrief({ sessionId, agentId });
  if (session === null || agent === null || brief === null) {
    return null;
  }
  return (
    <div className="grid max-h-[45%] shrink-0 grid-rows-[minmax(0,1fr)]">
      <ScrollFade viewportClassName="px-4 pt-3" fadeSize="h-6">
        <div data-testid="fix-run-lead">
          <FixRunSummary session={session} agent={agent} brief={brief} />
        </div>
      </ScrollFade>
    </div>
  );
};
