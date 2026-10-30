import { Button } from '@goodboy/ui';
import type { AgentId, OpenQuestionId, SessionId } from '@goodboy/types';
import { agentPlace, useAppStore } from '../../../../../store';

type Props = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly agentName: string;
  readonly questionId: OpenQuestionId;
  readonly count: number;
};

export const OtherAgentQuestionButton = ({
  sessionId,
  agentId,
  agentName,
  questionId,
  count,
}: Props) => {
  const navigate = useAppStore((s) => s.navigate);
  const requestOpenQuestionScroll = useAppStore((s) => s.requestOpenQuestionScroll);
  return (
    <div className="flex shrink-0 justify-center py-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          navigate({ to: agentPlace({ sessionId, agentId }) });
          requestOpenQuestionScroll({ agentId, questionId });
        }}
      >
        {count} {count === 1 ? 'open question' : 'open questions'} from {agentName}
      </Button>
    </div>
  );
};
