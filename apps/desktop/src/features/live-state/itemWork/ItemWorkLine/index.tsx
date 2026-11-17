import type { ReactNode } from 'react';
import { WorkNode, type WorkNodeMark } from '@goodboy/ui';
import type { AgentId } from '@goodboy/types';
import { useTailClock } from '../../useTailClock';
import { ITEM_WORK_WORDS, type ItemWorkState } from '../itemWorkWords';

type Props = {
  readonly state: ItemWorkState;
  readonly detail: string | null;
  readonly agentId?: AgentId | null;
  readonly isAgentWaiting?: boolean;
  readonly verbs?: ReactNode;
  readonly action?: ReactNode;
};

const NODE_MARK = { kind: 'dot' } as const satisfies WorkNodeMark;

const SEPARATOR = (
  <span aria-hidden className="shrink-0 text-faint-foreground">
    ·
  </span>
);

export const ItemWorkLine = ({
  state,
  detail,
  agentId = null,
  isAgentWaiting = false,
  verbs = null,
  action = null,
}: Props) => {
  const entry = ITEM_WORK_WORDS.state[state];
  const clock = useTailClock({
    startedAt: null,
    stepAgentId: agentId,
    isTicking: entry.hasClock && agentId !== null,
    isRunning: !isAgentWaiting,
  });
  const node = entry.node === 'running' && isAgentWaiting ? 'queued' : entry.node;
  return (
    <div
      data-item-work=""
      data-item-work-state={state}
      className="group/row flex min-h-6 min-w-0 items-center gap-2 text-meta text-muted-foreground"
    >
      <div
        role={entry.node === 'failed' ? 'alert' : 'status'}
        className="flex min-w-0 flex-1 items-center gap-2"
      >
        <span aria-hidden className="flex shrink-0">
          <WorkNode size="sm" state={node} mark={NODE_MARK} label={entry.word} />
        </span>
        <span className="shrink-0 whitespace-nowrap text-foreground">{entry.word}</span>
        {detail === null || detail === '' ? null : (
          <>
            {SEPARATOR}
            <span className="min-w-0 truncate">{detail}</span>
          </>
        )}
        {clock === null ? null : (
          <>
            {SEPARATOR}
            <span
              aria-hidden
              data-item-work-clock=""
              className="shrink-0 tabular-nums text-faint-foreground"
            >
              {clock}
            </span>
          </>
        )}
      </div>
      {verbs === null ? null : (
        <span data-item-work-verbs="" className="row-actions flex shrink-0 items-center gap-1">
          {verbs}
        </span>
      )}
      {action === null ? null : <span className="flex shrink-0 items-center gap-1">{action}</span>}
    </div>
  );
};
