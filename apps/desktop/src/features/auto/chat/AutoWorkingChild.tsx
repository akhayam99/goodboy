import type { AutoDelegation } from '@goodboy/db';
import { Chip, ICON_SIZE, WorkNode } from '@goodboy/ui';
import { agentKindPalette } from '../../session/agent-kind';
import { taskTitleOf } from '../taskTitleOf';
import { cardTitleOf } from './cardTitleOf';
import { delegationCardOf } from './delegationCardOf';
import { DelegationClock } from './DelegationClock';

type Props = {
  readonly delegation: AutoDelegation;
  readonly onOpen: () => void;
};

export const AutoWorkingChild = ({ delegation, onOpen }: Props) => {
  const card = delegationCardOf({ delegation, childAgent: null });
  const title = taskTitleOf({ request: delegation.request }) ?? cardTitleOf({ card });
  const Icon = agentKindPalette({ kind: card.role }).icon;
  return (
    <Chip
      kind="reference"
      tone={card.status.tone}
      ariaLabel={`Reveal ${title} in Agents`}
      title={title}
      icon={
        <WorkNode
          size="sm"
          state="running"
          label={card.status.word}
          mark={{ kind: 'glyph', glyph: <Icon size={ICON_SIZE.mark} aria-hidden /> }}
        />
      }
      label={<span className="min-w-0 truncate">{title}</span>}
      trailing={<DelegationClock agentId={delegation.childAgentId} isLive />}
      className="max-w-full"
      onClick={onOpen}
    />
  );
};
