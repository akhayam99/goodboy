import { cn, TruncatedText, WorkNode, type WorkNodeState } from '@goodboy/ui';
import type { PlanChecklist as Checklist, PlanItemState } from '../utils/planChecklist';

type Props = {
  readonly checklist: Checklist;
  readonly isLive: boolean;
};

const WORD: Record<PlanItemState, string> = {
  done: 'Done',
  running: 'In progress',
  todo: 'To do',
};

type NodeStateParams = {
  readonly state: PlanItemState;
  readonly isLive: boolean;
};

const nodeState = ({ state, isLive }: NodeStateParams): WorkNodeState => {
  if (state === 'done') {
    return 'done';
  }
  if (state === 'running') {
    return isLive ? 'running' : 'stopped';
  }
  return 'queued';
};

export const PlanChecklist = ({ checklist, isLive }: Props) => (
  <section aria-label="Plan" className="flex min-w-0 flex-col rounded-lg bg-subtle px-4 py-2">
    <ol className="flex flex-col">
      {checklist.items.map((item, index) => (
        <li
          key={`${index}-${item.text}`}
          data-plan-state={item.state}
          className="flex h-7 min-w-0 items-center gap-2 text-meta"
        >
          <span className="flex size-5 shrink-0 items-center justify-center">
            <WorkNode
              size="sm"
              state={nodeState({ state: item.state, isLive })}
              mark={{ kind: 'dot' }}
              label={WORD[item.state]}
            />
          </span>
          <TruncatedText
            tooltip={item.text}
            className={cn(
              'min-w-0 truncate',
              item.state === 'running' ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {item.text}
          </TruncatedText>
        </li>
      ))}
    </ol>
  </section>
);
