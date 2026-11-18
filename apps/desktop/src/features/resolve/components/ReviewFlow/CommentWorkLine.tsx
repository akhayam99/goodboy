import { Button } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { ItemWorkLine } from '../../../live-state/itemWork/ItemWorkLine';
import { agentStepPhraseOf } from '../../../live-state/itemWork/agentStepPhraseOf';
import { ITEM_WORK_WORDS } from '../../../live-state/itemWork/itemWorkWords';
import type { CommentWork } from '../../commentWorkOf';
import { StopRunButton } from './StopRunButton';

export type StopWorkParams = {
  readonly agentId: AgentId;
};

type Props = {
  readonly sessionId: SessionId;
  readonly work: CommentWork;
  readonly onStop: (params: StopWorkParams) => void;
};

export const CommentWorkLine = ({ sessionId, work, onStop }: Props) => {
  const openDrawer = useAppStore((store) => store.openDrawer);
  const isFixing = work.state === 'fixing';
  const agentId = work.agentId;
  const step = useAppStore((store) => {
    if (!isFixing || agentId === null) {
      return null;
    }
    const transcript = store.transcripts[agentId];
    return transcript === undefined ? null : agentStepPhraseOf({ transcript });
  });
  const isAgentWaiting = useAppStore(
    (store) => isFixing && agentId !== null && store.agentTurnState[agentId]?.kind === 'blocked',
  );
  return (
    <ItemWorkLine
      state={work.state}
      detail={isFixing ? step : work.detail}
      agentId={isFixing ? agentId : null}
      isAgentWaiting={isAgentWaiting}
      verbs={
        agentId === null ? null : (
          <>
            <StopRunButton onStop={() => onStop({ agentId })} batchSize={work.batchSize} />
            <Button
              size="xs"
              variant="quiet"
              onClick={() => openDrawer({ kind: 'transcript', sessionId, payload: { agentId } })}
            >
              {ITEM_WORK_WORDS.verb.openTranscript}
            </Button>
          </>
        )
      }
    />
  );
};
