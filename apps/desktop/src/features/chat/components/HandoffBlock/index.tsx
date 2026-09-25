import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { TranscriptItem } from '../../utils/transcript-items';
import { UserText } from '../TranscriptCards/UserText';
import { HandoffAlsoReceived } from './HandoffAlsoReceived';
import { HandoffCard } from './HandoffCard';
import { HandoffOlderFormat } from './HandoffOlderFormat';
import { useAgentHandoff } from './useAgentHandoff';

type Props = {
  readonly item: Extract<TranscriptItem, { kind: 'handoff' }>;
  readonly sessionId: SessionId | null;
  readonly agentId: AgentId | null;
  readonly workingDir: string | null;
};

export const HandoffBlock = ({ item, sessionId, agentId, workingDir }: Props) => {
  const state = useAgentHandoff({ agentId: item.handoffId });
  const replyAgentId = item.handoffId ?? agentId;
  const hasReply = useAppStore((store) =>
    replyAgentId === null
      ? false
      : (store.transcripts[replyAgentId] ?? []).some((event) => event.kind === 'assistant_text'),
  );

  if (state.status === 'loading') {
    return null;
  }
  if (state.status === 'missing') {
    return <HandoffOlderFormat text={item.text} at={item.at} />;
  }
  if (state.handoff.sender.kind === 'you') {
    return (
      <div className="flex min-w-0 flex-col gap-2">
        <HandoffAlsoReceived handoff={state.handoff} sessionId={sessionId} />
        <UserText
          text={item.text}
          at={item.at}
          attachments={item.attachments}
          provider={item.provider}
          model={item.model}
          workingDir={workingDir}
        />
      </div>
    );
  }
  return (
    <HandoffCard
      handoff={state.handoff}
      sessionId={sessionId}
      at={item.at}
      initiallyOpen={!hasReply}
    />
  );
};
