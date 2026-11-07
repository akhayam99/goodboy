import type { SessionId } from '@goodboy/types';
import { agentPlace, useAppStore } from '../../../../store';
import { NAMES } from '../../../../shared/utils/names';
import { DelegationClock } from '../../../auto/chat/DelegationClock';
import { ObjectMenuArea } from '../../../actions/ObjectMenuArea';
import { agentKindPalette } from '../../agent-kind';
import { LiveAutoAgents } from './LiveAutoAgents';
import { LiveGlyph } from './LiveGlyph';
import type { LiveAutoGroup } from './liveGroupsOf';
import { LiveRow } from './LiveRow';
import { LiveStateWord } from './LiveStateWord';
import { liveAutoNameOf } from './liveAutoNameOf';
import { liveOwnStateOf } from './liveOwnStateOf';
import { liveStatusOf } from './liveStatusOf';
import { LIVE_TONE } from './liveTone';

type Props = {
  readonly sessionId: SessionId;
  readonly group: LiveAutoGroup;
  readonly where: string | null;
};

export const LiveAutoBlock = ({ sessionId, group, where }: Props) => {
  const navigate = useAppStore((state) => state.navigate);
  const auto = group.group;
  const title = liveAutoNameOf({ group });
  const stateSpec = LIVE_TONE.state[group.state];
  const tone = stateSpec.tone;
  const palette = agentKindPalette({ kind: 'auto' });
  const isStateWord = auto.word.includes(' ') && !auto.word.includes(': ');
  const status = isStateWord
    ? { word: stateSpec.word, reason: auto.word === stateSpec.word ? null : auto.word }
    : liveStatusOf({ word: auto.word, detail: null });
  const isOwn = liveOwnStateOf({ group, isStateWord });
  return (
    <section
      aria-label={`${NAMES.runKind.autoAgent}: ${title}`}
      data-live-group="auto"
      data-state={group.state}
      className="flex min-w-0 flex-col"
    >
      <ObjectMenuArea
        target={{ kind: 'agent', sessionId, agentId: auto.rootAgentId }}
        anchorKey={`live-auto:${auto.rootAgentId}`}
      >
        <LiveRow
          glyph={<LiveGlyph icon={palette.icon} colorClass={palette.fg} />}
          kindWord={NAMES.runKind.autoAgent}
          title={title}
          reason={status.reason}
          openLabel="Open Auto chat"
          onOpen={() => navigate({ to: agentPlace({ sessionId, agentId: auto.rootAgentId }) })}
          where={where}
          end={
            <LiveStateWord
              tone={tone}
              word={status.word}
              autoWord={auto.isStuck ? 'stuck' : auto.phase}
              isSectionState={isOwn}
            />
          }
          time={<DelegationClock agentId={auto.rootAgentId} isLive={auto.phase === 'running'} />}
        />
      </ObjectMenuArea>
      <LiveAutoAgents sessionId={sessionId} group={group} />
    </section>
  );
};
