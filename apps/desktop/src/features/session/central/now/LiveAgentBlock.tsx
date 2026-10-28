import type { SessionId } from '@goodboy/types';
import { agentPlace, useAppStore } from '../../../../store';
import { DelegationClock } from '../../../auto/chat/DelegationClock';
import { rowStateSentence, rowStateShortSentence } from '../../../workTreeModel/rowStateCopy';
import { AGENT_KIND_META, agentKindPalette } from '../../agent-kind';
import { LiveChildren } from './LiveChildren';
import { LiveGlyph } from './LiveGlyph';
import type { LiveAgentGroup } from './liveGroupsOf';
import { LiveRow } from './LiveRow';
import { LiveStateWord } from './LiveStateWord';
import { liveStatusOf } from './liveStatusOf';
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
  const palette = agentKindPalette({ kind: agentKind });
  const status = liveStatusOf({
    word: rowStateShortSentence({ state: group.rowState }) ?? stateSpec.word,
    detail: group.state === 'working' ? null : rowStateSentence({ state: group.rowState }),
  });
  return (
    <section
      aria-label={`${noun}: ${group.title}`}
      data-live-group="agent"
      data-state={group.state}
      className="flex min-w-0 flex-col"
    >
      <LiveRow
        glyph={<LiveGlyph icon={palette.icon} colorClass={palette.fg} />}
        kindWord={noun}
        title={group.title}
        reason={status.reason}
        openLabel={`Open ${group.title}`}
        onOpen={() => navigate({ to: agentPlace({ sessionId, agentId: agent.id }) })}
        where={where}
        end={<LiveStateWord tone={stateSpec.tone} word={status.word} />}
        time={<DelegationClock agentId={agent.id} isLive={group.rowState.phase === 'running'} />}
      />
      <LiveChildren sessionId={sessionId} parentTitle={group.title} items={group.children} />
    </section>
  );
};
