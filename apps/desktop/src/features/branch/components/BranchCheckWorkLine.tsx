import { Button } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { useAgentStop } from '../../../shared/hooks/useAgentStop';
import { NAMES } from '../../../shared/utils/names';
import { TailLine } from '../../live-state/TailLine';
import { TAIL_ACTION } from '../../live-state/tailAction';

type Props = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly isFixing: boolean;
  readonly checkName: string | null;
};

export const BranchCheckWorkLine = ({ sessionId, agentId, isFixing, checkName }: Props) => {
  const openDrawer = useAppStore((s) => s.openDrawer);
  const agentStop = useAgentStop({ sessionId, agentId });
  const name = checkName ?? 'the failing check';
  return (
    <section aria-label="Check fix status" data-testid="branch-check-work" className="min-w-0">
      <TailLine
        facts={{
          state: agentStop.phase === 'idle' ? 'working' : 'stopping',
          phrase: isFixing ? `Fixing ${name}` : `Analyzing ${name}`,
          startedAt: null,
          stepAgentId: agentId,
          actions: [TAIL_ACTION.viewTranscript],
        }}
        onAction={(id) => {
          if (id === 'viewTranscript') {
            openDrawer({ kind: 'transcript', sessionId, payload: { agentId } });
          }
        }}
        verbs={
          agentStop.phase === 'idle' ? (
            <Button size="xs" variant="ghost-danger" onClick={agentStop.stop}>
              {NAMES.stop}
            </Button>
          ) : null
        }
      />
    </section>
  );
};
