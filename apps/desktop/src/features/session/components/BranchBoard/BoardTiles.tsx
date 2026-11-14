import { formatUsd, StatCard } from '@goodboy/ui';
import { elapsedWordOf } from '../../central/board/boardRowWordsOf';
import { checksTileOf } from '../../central/board/checksTileOf';
import { countWordOf } from '../../central/board/countWordOf';
import type { SessionKpis } from '../../central/board/sessionKpisOf';
import type { BoardFilter } from '../../central/board/visibleGroupsOf';

type FilterParams = {
  readonly filter: BoardFilter | null;
};

type Props = {
  readonly kpis: SessionKpis;
  readonly filter: BoardFilter | null;
  readonly onFilter: (params: FilterParams) => void;
};

export const BoardTiles = ({ kpis, filter, onFilter }: Props) => {
  const { branches, needsYou, checks } = kpis;
  const isAllMerged = branches.total > 0 && branches.merged === branches.total;
  const checksTile = checksTileOf({ checks });
  const checksHint = checksTile.isFailing && checks.passing > 0 ? `${checks.passing} passing` : '';
  return (
    <div data-slot="session-kpis" className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <StatCard
        label="Branches"
        value={String(branches.merged)}
        unit={`of ${branches.total} merged`}
        {...(isAllMerged && { valueTone: 'success' as const })}
        reservesDeltaRow
        onClick={() => onFilter({ filter: null })}
      />
      <StatCard
        label="Needs you"
        value={String(needsYou.count)}
        {...(needsYou.count > 0 && { valueTone: 'warning' as const })}
        {...(needsYou.askCount > 0 && {
          hint: countWordOf({ count: needsYou.askCount, noun: 'question' }),
        })}
        isPressed={filter === 'needs-you'}
        reservesDeltaRow
        onClick={() => onFilter({ filter: filter === 'needs-you' ? null : 'needs-you' })}
      />
      <StatCard
        label="Checks"
        value={checksTile.value}
        unit={checksTile.unit}
        {...(checksTile.isFailing && { valueTone: 'danger' as const })}
        {...(checksHint !== '' && { hint: checksHint })}
        isPressed={filter === 'checks'}
        reservesDeltaRow
        onClick={() => onFilter({ filter: filter === 'checks' ? null : 'checks' })}
      />
      <StatCard
        label="Spend"
        value={formatUsd(kpis.spendUsd)}
        hint={`${countWordOf({ count: kpis.leadCount, noun: 'Lead' })}, ${countWordOf({ count: kpis.agentCount, noun: 'agent' })}`}
        reservesDeltaRow
      />
      <StatCard
        label="Time"
        value={elapsedWordOf({ elapsedMs: kpis.elapsedMs })}
        hint="Agents working"
        reservesDeltaRow
      />
    </div>
  );
};
