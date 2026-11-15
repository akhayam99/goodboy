import { Button } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { useAgentStop } from '../../../shared/hooks/useAgentStop';
import { NAMES } from '../../../shared/utils/names';
import { TailLine } from '../../live-state/TailLine';
import { TAIL_ACTION } from '../../live-state/tailAction';
import { actionButtonLookOf } from '../../actions/actionButtonLookOf';

const STOP_LOOK = actionButtonLookOf({ verb: 'stop', variant: 'quiet' });

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
  const isStopping = agentStop.phase === 'stopping';
  return (
    <section aria-label="Check fix status" data-testid="branch-check-work" className="min-w-0">
      <TailLine
        facts={{
          state: isStopping ? 'stopping' : 'working',
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
          isStopping ? null : (
            <Button
              size="xs"
              variant={STOP_LOOK.variant}
              intent={STOP_LOOK.intent}
              onClick={agentStop.stop}
            >
              {NAMES.stop}
            </Button>
          )
        }
      />
    </section>
  );
};
