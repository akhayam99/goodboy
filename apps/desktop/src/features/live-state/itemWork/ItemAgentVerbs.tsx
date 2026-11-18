import { Button } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { useAgentStop } from '../../../shared/hooks/useAgentStop';
import { actionButtonLookOf } from '../../actions/actionButtonLookOf';
import { ITEM_WORK_WORDS } from './itemWorkWords';

type Props = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

const STOP_LOOK = actionButtonLookOf({ verb: ITEM_WORK_WORDS.verb.stop, variant: 'quiet' });

export const ItemAgentVerbs = ({ sessionId, agentId }: Props) => {
  const openDrawer = useAppStore((state) => state.openDrawer);
  const agentStop = useAgentStop({ sessionId, agentId });
  return (
    <>
      <Button
        size="xs"
        variant={STOP_LOOK.variant}
        intent={STOP_LOOK.intent}
        isBusy={agentStop.phase === 'stopping'}
        onClick={agentStop.stop}
      >
        {ITEM_WORK_WORDS.verb.stop}
      </Button>
      <Button
        size="xs"
        variant="quiet"
        onClick={() => openDrawer({ kind: 'transcript', sessionId, payload: { agentId } })}
      >
        {ITEM_WORK_WORDS.verb.openTranscript}
      </Button>
    </>
  );
};
