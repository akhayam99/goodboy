import type { ReactNode } from 'react';
import { Eyebrow, StatusDot, ToneBar, cn, type Tone } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { BranchList } from '../branches/BranchList';
import type { BranchEntry } from '../branches/branchStoryOf';
import { LiveGroup } from './LiveGroup';
import type { LiveGroupModel } from './liveGroupsOf';
import { NOW_STATE_WORD, type NowState } from './nowStateOf';

export type NowChipParams = {
  readonly group: LiveGroupModel;
};

type Props = {
  readonly sessionId: SessionId;
  readonly state: NowState;
  readonly sentence: string;
  readonly groups: ReadonlyArray<LiveGroupModel>;
  readonly entries: ReadonlyArray<BranchEntry>;
  readonly chipFor?: (params: NowChipParams) => ReactNode;
};

const STATE_TONE: Record<NowState, Tone> = {
  stuck: 'danger',
  waiting: 'warning',
  working: 'info',
  done: 'success',
  idle: 'neutral',
};

const STATE_TEXT: Record<NowState, string> = {
  stuck: 'text-danger',
  waiting: 'text-warning',
  working: 'text-foreground',
  done: 'text-foreground',
  idle: 'text-muted-foreground',
};

export const NowBlockView = ({ sessionId, state, sentence, groups, entries, chipFor }: Props) => {
  return (
    <section
      aria-label="Now"
      data-now-state={state}
      className="relative flex min-w-0 flex-col gap-3 rounded-lg bg-subtle p-4"
    >
      {state === 'waiting' ? <ToneBar tone="warning" density="card" /> : null}
      {state === 'stuck' ? <ToneBar tone="danger" density="card" /> : null}
      <div className="flex items-center gap-2">
        <Eyebrow label="Now" muted />
        <StatusDot tone={STATE_TONE[state]} size="sm" />
        <span className={cn('text-label', STATE_TEXT[state])}>{NOW_STATE_WORD[state]}</span>
      </div>
      <p data-now-sentence="" className="text-body text-foreground">
        {sentence}
      </p>
      {groups.length === 0 ? null : (
        <div className="flex min-w-0 flex-col gap-2">
          {groups.map((group) => (
            <LiveGroup
              key={`${group.kind}:${group.id}`}
              sessionId={sessionId}
              group={group}
              chip={chipFor?.({ group })}
            />
          ))}
        </div>
      )}
      {entries.length === 0 ? null : <BranchList sessionId={sessionId} entries={entries} />}
    </section>
  );
};
