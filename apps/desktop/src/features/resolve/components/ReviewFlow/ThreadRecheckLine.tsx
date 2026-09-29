import { useShallow } from 'zustand/react/shallow';
import { WorkNode } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { modelLabel } from '../../../chat/utils/chat-constants';
import { draftRoutingOf } from '../../draftFixes';
import { RECHECK_LABEL } from '../../reviewFlowCopy';
import { recheckModelOf } from '../../startRecheck';
import { ThreadRecheckLive } from './ThreadRecheckLive';

type Props = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId | null;
};

export const ThreadRecheckLine = ({ sessionId, agentId }: Props) => {
  const provider = useAppStore(useShallow((s) => draftRoutingOf({ state: s, sessionId }))).provider;
  const model = recheckModelOf({ provider });
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="flex min-w-0 items-center gap-2 text-label">
        <WorkNode state="running" label={RECHECK_LABEL.running} mark={{ kind: 'dot' }} />
        <span className="shrink-0 text-foreground">{RECHECK_LABEL.running}</span>
        {model !== null && (
          <span className="min-w-0 truncate text-muted-foreground">· {modelLabel(model)}</span>
        )}
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
