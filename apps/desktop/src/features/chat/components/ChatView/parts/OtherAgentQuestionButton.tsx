import { Button } from '@goodboy/ui';
import type { OpenQuestionId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { openQuestion } from '../../../../session/openQuestion';

type Props = {
  readonly sessionId: SessionId;
  readonly agentName: string;
  readonly questionId: OpenQuestionId;
  readonly count: number;
};

export const OtherAgentQuestionButton = ({ sessionId, agentName, questionId, count }: Props) => {
  const navigate = useAppStore((s) => s.navigate);
  const drawer = useAppStore((s) => s.drawer);
  return (
    <div className="flex shrink-0 justify-center py-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          openQuestion({ state: { drawer, navigate }, sessionId, questionId });
        }}
      >
        {count} {count === 1 ? 'open question' : 'open questions'} from {agentName}
      </Button>
    </div>
  );
};
