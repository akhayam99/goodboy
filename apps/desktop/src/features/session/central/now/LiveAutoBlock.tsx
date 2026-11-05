import { useState } from 'react';
import { Button, type Tone } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { agentPlace, useAppStore } from '../../../../store';
import { pluralize } from '../../../../shared/utils/pluralize';
import { NAMES } from '../../../../shared/utils/names';
import { DelegationClock } from '../../../auto/chat/DelegationClock';
import { ObjectMenuArea } from '../../../actions/ObjectMenuArea';
import { autoChildCopyOf } from '../../../auto/group/autoChildCopyOf';
import type { AutoGroupChild } from '../../../auto/autoGroupOf';
import { agentKindPalette } from '../../agent-kind';
import { LiveGlyph } from './LiveGlyph';
import type { LiveAutoGroup } from './liveGroupsOf';
import { LiveRow } from './LiveRow';
import { LiveSpine } from './LiveSpine';
import { LiveStateWord } from './LiveStateWord';
import { liveOwnStateOf } from './liveOwnStateOf';
import { liveStatusOf } from './liveStatusOf';
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
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useAppStore((state) => state.navigate);
  const openDrawer = useAppStore((state) => state.openDrawer);
  const auto = group.group;
  const isGenericTitle = auto.title === null || auto.title.toLowerCase() === 'auto';
  const title = isGenericTitle ? NAMES.runKind.autoAgent : auto.title;
  const stateSpec = LIVE_TONE.state[group.state];
  const tone = group.state === 'stuck' ? 'danger' : stateSpec.tone;
  const palette = agentKindPalette({ kind: 'auto' });
  const status =
    auto.word.includes(' ') && !auto.word.includes(': ')
      ? { word: stateSpec.word, reason: auto.word }
      : liveStatusOf({ word: auto.word, detail: null });
  const isOwn = liveOwnStateOf({ group, word: status.word });
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
      {auto.children.length === 0 ? null : (
        <div data-live-agents-toggle="" className="flex min-w-0">
          <Button
            size="sm"
            variant="quiet"
            aria-expanded={isOpen}
            onClick={() => setIsOpen((isShown) => !isShown)}
          >
            {isOpen ? 'Hide agents' : pluralize(auto.children.length, 'agent')}
          </Button>
        </div>
      )}
      {auto.children.length === 0 || !isOpen ? null : (
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
              isSectionState: group.state === 'working' && child.state === 'running',
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
