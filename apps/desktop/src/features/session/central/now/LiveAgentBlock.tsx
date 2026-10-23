import type { SessionId } from '@goodboy/types';
import { agentPlace, useAppStore } from '../../../../store';
import { AgentKindChip } from '../../../../shared/components/AgentKindChip';
import { DelegationClock } from '../../../auto/chat/DelegationClock';
import { rowStateShortSentence } from '../../../workTreeModel/rowStateCopy';
import { AGENT_KIND_META } from '../../agent-kind';
import { LiveChildren } from './LiveChildren';
import type { LiveAgentGroup } from './liveGroupsOf';
import { LiveRow } from './LiveRow';
import { LiveStateWord } from './LiveStateWord';
import { LIVE_TONE } from './liveTone';

type Props = {
  readonly sessionId: SessionId;
  readonly group: LiveAgentGroup;
  readonly where: string | null;
};

export const LiveAgentBlock = ({ sessionId, group, where }: Props) => {
  const navigate = useAppStore((state) => state.navigate);
  const { agent, agentKind } = group.entry;
  const noun = AGENT_KIND_META[agentKind].noun;
  const stateSpec = LIVE_TONE.state[group.state];
  const word = rowStateShortSentence({ state: group.rowState }) ?? stateSpec.word;
  return (
    <section
      aria-label={`${noun}: ${group.title}`}
      data-live-group="agent"
      data-state={group.state}
      className="flex min-w-0 flex-col"
    >
      <LiveRow
        glyph={<AgentKindChip kind={agentKind} density="glyph" isDecorative />}
        kindWord={noun}
        title={group.title}
        openLabel={`Open ${group.title}`}
        onOpen={() => navigate({ to: agentPlace({ sessionId, agentId: agent.id }) })}
        where={where}
        end={<LiveStateWord tone={stateSpec.tone} word={word} />}
        time={<DelegationClock agentId={agent.id} isLive={group.rowState.phase === 'running'} />}
      />
      <LiveChildren sessionId={sessionId} parentTitle={group.title} items={group.children} />
    </section>
  );
};
