import { Button } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import type { AgentKindRouting } from '../../../session/agent-kind';
import { OUTCOME_ACTION } from '../../commentOutcomeCopy';
import type { ReviewEntry } from '../ReviewFlow/useReviewEntries';
import { useFixLaunch } from './useFixLaunch';

type Props = {
  readonly sessionId: SessionId;
  readonly entry: ReviewEntry;
  readonly sentence: string;
  readonly routing: AgentKindRouting;
  readonly onStarted: () => void;
};

export const OutcomeFailed = ({ sessionId, entry, sentence, routing, onStarted }: Props) => {
  const launch = useFixLaunch({
    sessionId,
    routing,
    threadIds: [entry.threadId],
    hint: entry.row.attempt?.launchChoice?.hint ?? '',
    onStarted,
  });
  const mode = entry.row.attempt?.launchChoice?.mode ?? 'apply';
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="text-meta text-danger">{sentence}</p>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          isBusy={launch.isStarting}
          onClick={() => void launch.start(mode)}
        >
          {OUTCOME_ACTION.retry}
        </Button>
      </div>
      {launch.error !== null && (
        <p role="alert" className="text-meta text-danger">
          {launch.error}
        </p>
      )}
    </div>
  );
};
