import type { ReactNode } from 'react';
import { Eyebrow, StatusDot, cn, type Tone } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';
import { BranchList } from '../branches/BranchList';
import type { BranchEntry } from '../branches/branchStoryOf';
import { LiveGroup } from './LiveGroup';
import { NeedsYouCount } from './NeedsYouCount';
import type { LiveGroupModel } from './liveGroupsOf';
import { NOW_STATE_WORD, type NowState } from './nowStateOf';

type Props = {
  readonly sessionId: SessionId;
  readonly state: NowState;
  readonly sentence: string;
  readonly needsYouCount: number;
  readonly onShowNext: () => void;
  readonly actions?: ReactNode;
  readonly groups: ReadonlyArray<LiveGroupModel>;
  readonly entries: ReadonlyArray<BranchEntry>;
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

export const NowBlockView = ({
  sessionId,
  state,
  sentence,
  needsYouCount,
  onShowNext,
  actions,
  groups,
  entries,
}: Props) => {
  const session = useAppStore((store) => sessionById(store.sessions, sessionId) ?? null);
  return (
    <section
      aria-label="Now"
      data-now-state={state}
      className="flex min-w-0 flex-col gap-3 rounded-lg bg-subtle p-4"
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <Eyebrow label="Now" muted />
          <StatusDot tone={STATE_TONE[state]} size="sm" />
          <span className={cn('text-label', STATE_TEXT[state])}>{NOW_STATE_WORD[state]}</span>
        </span>
        {needsYouCount === 0 ? null : (
          <NeedsYouCount count={needsYouCount} onShowNext={onShowNext} />
        )}
      </div>
      <p data-now-sentence="" className="text-body text-foreground">
        {sentence}
      </p>
      {actions}
      {groups.length === 0 ? null : (
        <div className="@container flex min-w-0 flex-col gap-2">
          {groups.map((group) => (
            <LiveGroup
              key={`${group.kind}:${group.id}`}
              sessionId={sessionId}
              session={session}
              group={group}
              where={null}
            />
          ))}
        </div>
      )}
      {entries.length === 0 ? null : <BranchList sessionId={sessionId} entries={entries} />}
    </section>
  );
};
