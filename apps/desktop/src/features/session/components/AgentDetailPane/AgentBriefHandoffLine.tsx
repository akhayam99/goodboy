import { ChevronRight } from 'lucide-react';
import type { AgentId, SessionId } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { HANDOFF_SENDER_ICON } from '../../../chat/components/HandoffBlock/handoffSenderIcon';
import { requestHandoffOpen } from '../../../chat/components/HandoffBlock/handoffOpenRequest';
import { useAgentHandoff } from '../../../chat/components/HandoffBlock/useAgentHandoff';
import { useHandoffNames } from '../../../chat/components/HandoffBlock/useHandoffNames';
import { handoffSenderLabel } from '../../../chat/utils/handoffLabels';

type Props = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

export const AgentBriefHandoffLine = ({ sessionId, agentId }: Props) => {
  const state = useAgentHandoff({ agentId });
  const handoff = state.status === 'ready' ? state.handoff : null;
  const names = useHandoffNames({ sessionId, sender: handoff?.sender ?? null });
  if (handoff === null) {
    return null;
  }
  const Icon = HANDOFF_SENDER_ICON[handoff.sender.kind];
  const isYou = handoff.sender.kind === 'you';

  return (
    <button
      type="button"
      data-testid="agent-brief-handoff-line"
      onClick={() => requestHandoffOpen({ agentId })}
      className="flex min-w-0 items-center gap-2 rounded-md bg-subtle px-2 py-1.5 text-left text-xs transition-colors hover:bg-hover"
    >
      <Icon size={ICON_SIZE.row} aria-hidden className="shrink-0 text-muted-foreground" />
      <span className="shrink-0 text-muted-foreground">{isYou ? 'Started by' : 'Sent by'}</span>
      <span className="shrink-0 text-foreground">
        {isYou ? 'you' : handoffSenderLabel({ sender: handoff.sender, names })}
      </span>
      <span aria-hidden className="shrink-0 text-faint-foreground">
        ·
      </span>
      <span className="min-w-0 flex-1 truncate text-muted-foreground">{handoff.ask}</span>
      <span className="inline-flex shrink-0 items-center gap-0.5 font-medium text-muted-foreground">
        Open in transcript
        <ChevronRight size={ICON_SIZE.row} aria-hidden />
      </span>
    </button>
  );
};
