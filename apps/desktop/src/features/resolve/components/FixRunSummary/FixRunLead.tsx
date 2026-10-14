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
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ScrollFade className="min-h-0 flex-1" viewportClassName="px-4 py-3" fadeSize={24}>
        <div data-testid="fix-run-lead">
          <FixRunSummary session={session} agent={agent} brief={brief} />
        </div>
      </ScrollFade>
    </div>
  );
};
