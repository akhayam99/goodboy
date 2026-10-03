import { useShallow } from 'zustand/react/shallow';
import { WorkNode } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { modelLabel } from '../../../chat/utils/chat-constants';
import { RECHECK_LABEL } from '../../reviewFlowCopy';
import { recheckModelOf } from '../../startRecheck';
import { ThreadRecheckLive } from './ThreadRecheckLive';

type Props = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId | null;
};

export const ThreadRecheckLine = ({ sessionId, agentId }: Props) => {
  const recheck = useAppStore(
    useShallow((s) => {
      const taskModel = recheckModelOf({ state: s, sessionId });
      return { provider: taskModel.providerId, model: taskModel.model };
    }),
  );
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="flex min-w-0 items-center gap-2 text-label">
        <WorkNode state="running" label={RECHECK_LABEL.running} mark={{ kind: 'dot' }} />
        <span className="shrink-0 text-foreground">{RECHECK_LABEL.running}</span>
        <span className="min-w-0 truncate text-muted-foreground">
          · {modelLabel(recheck.model, recheck.provider)}
        </span>
      </p>
      {agentId === null ? (
        <p className="min-w-0 truncate pl-7 text-secondary text-muted-foreground">
          {RECHECK_LABEL.looking}
        </p>
      ) : (
        <ThreadRecheckLive agentId={agentId} />
      )}
    </div>
  );
};
