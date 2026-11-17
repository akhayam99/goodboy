import { OverflowMenu, type MenuEntry } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { ItemWorkLine } from '../../../live-state/itemWork/ItemWorkLine';
import { ITEM_WORK_WORDS } from '../../../live-state/itemWork/itemWorkWords';
import { fixRunCountOf, type FixRun } from '../../fixRun';
import type { LaneStatus } from '../../laneStatus';
import { fixingPlaceText, threadCountText } from '../../reviewLaunchCopy';

type Props = {
  readonly sessionId: SessionId;
  readonly run: FixRun;
  readonly lane: LaneStatus | null;
};

const FIX_RUN_COUNT_COPY = {
  stopDescription: 'Comments it has not finished stay open and can be fixed again.',
  menu: 'Fix actions',
} as const;

export const FixRunCount = ({ sessionId, run, lane }: Props) => {
  const openDrawer = useAppStore((s) => s.openDrawer);
  const forceCloseResolver = useAppStore((s) => s.forceCloseResolver);
  const stopResolveLane = useAppStore((s) => s.stopResolveLane);
  const count = fixRunCountOf({ run });
  if (count === null) {
    return null;
  }
  const entries: ReadonlyArray<MenuEntry> = [
    {
      kind: 'item',
      key: 'stop-all',
      label: ITEM_WORK_WORDS.verb.stopAll,
      isDestructive: true,
      confirm: {
        title: `Stop the fix for ${threadCountText({ count: run.total })}?`,
        description: FIX_RUN_COUNT_COPY.stopDescription,
        confirmLabel: ITEM_WORK_WORDS.verb.stopAll,
        role: 'danger',
      },
      onSelect: () =>
        lane === null
          ? forceCloseResolver(sessionId, run.agentId)
          : stopResolveLane({ sessionId, worktreePath: lane.worktreePath }),
    },
    {
      kind: 'item',
      key: 'open-transcript',
      label: ITEM_WORK_WORDS.verb.openTranscript,
      onSelect: () =>
        openDrawer({ kind: 'transcript', sessionId, payload: { agentId: run.agentId } }),
    },
  ];
  return (
    <span data-fix-run-count="" className="flex min-w-0 justify-end">
      <ItemWorkLine
        state="fixing"
        detail={fixingPlaceText(count)}
        agentId={run.agentId}
        action={<OverflowMenu label={FIX_RUN_COUNT_COPY.menu} entries={entries} />}
      />
    </span>
  );
};
