import type { Tone } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { agentPlace, useAppStore } from '../../../../store';
import { AgentKindChip } from '../../../../shared/components/AgentKindChip';
import { NAMES } from '../../../../shared/utils/names';
import { DelegationClock } from '../../../auto/chat/DelegationClock';
import { autoChildCopyOf } from '../../../auto/group/autoChildCopyOf';
import type { AutoGroupChild } from '../../../auto/autoGroupOf';
import type { LiveAutoGroup } from './liveGroupsOf';
import { LiveRow } from './LiveRow';
import { LiveSpine } from './LiveSpine';
import { LiveStateWord } from './LiveStateWord';
import { LIVE_TONE } from './liveTone';

type Props = {
  readonly sessionId: SessionId;
  readonly group: LiveAutoGroup;
  readonly where: string | null;
};

type ChildParams = {
  readonly child: AutoGroupChild;
};

const childToneOf = ({ child }: ChildParams): Tone => {
  const copy = autoChildCopyOf({ child });
  if (copy.isDanger) {
    return 'danger';
  }
  return copy.isLive ? 'info' : 'neutral';
};

export const LiveAutoBlock = ({ sessionId, group, where }: Props) => {
  const navigate = useAppStore((state) => state.navigate);
  const openDrawer = useAppStore((state) => state.openDrawer);
  const auto = group.group;
  const title = auto.title ?? NAMES.runKind.autoAgent;
  const tone = group.state === 'stuck' ? 'danger' : LIVE_TONE.state[group.state].tone;
  return (
    <section
      aria-label={`${NAMES.runKind.autoAgent}: ${title}`}
      data-live-group="auto"
      data-state={group.state}
      className="flex min-w-0 flex-col"
    >
      <LiveRow
        glyph={<AgentKindChip kind="auto" density="glyph" isDecorative />}
        kindWord={NAMES.runKind.autoAgent}
        title={title}
        openLabel="Open Auto chat"
        onOpen={() => navigate({ to: agentPlace({ sessionId, agentId: auto.rootAgentId }) })}
        where={where}
        end={
          <LiveStateWord
            tone={tone}
            word={auto.word}
            autoWord={auto.isStuck ? 'stuck' : auto.phase}
          />
        }
        time={<DelegationClock agentId={auto.rootAgentId} isLive={auto.phase === 'running'} />}
      />
      {auto.children.length === 0 ? null : (
        <LiveSpine
          label={`Under ${title}`}
          items={auto.children.map((child) => {
            const copy = autoChildCopyOf({ child });
            return {
              key: child.delegationId ?? child.agentId,
              kind: child.kind,
              noun: child.label,
              title: child.asked ?? '',
              word: copy.word,
              tone: childToneOf({ child }),
              time: <DelegationClock agentId={child.agentId} isLive={copy.isLive} />,
              openLabel: `${child.label}, ${copy.word.toLowerCase()}`,
              onOpen: () =>
                openDrawer({
                  kind: 'auto-child',
                  sessionId,
                  payload: { agentId: child.agentId },
                }),
            };
          })}
        />
      )}
    </section>
  );
};
