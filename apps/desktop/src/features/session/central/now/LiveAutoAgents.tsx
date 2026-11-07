import { useState } from 'react';
import { Button, type Tone } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { pluralize } from '../../../../shared/utils/pluralize';
import { DelegationClock } from '../../../auto/chat/DelegationClock';
import { autoChildCopyOf } from '../../../auto/group/autoChildCopyOf';
import type { AutoGroupChild } from '../../../auto/autoGroupOf';
import type { LiveAutoGroup } from './liveGroupsOf';
import { LiveSpine } from './LiveSpine';
import { liveAutoNameOf } from './liveAutoNameOf';

type Props = {
  readonly sessionId: SessionId;
  readonly group: LiveAutoGroup;
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

export const LiveAutoAgents = ({ sessionId, group }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const openDrawer = useAppStore((state) => state.openDrawer);
  const auto = group.group;
  const title = liveAutoNameOf({ group });
  if (auto.children.length === 0) {
    return null;
  }
  return (
    <>
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
      {isOpen ? (
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
      ) : null}
    </>
  );
};
