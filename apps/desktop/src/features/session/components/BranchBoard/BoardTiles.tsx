import { formatUsd, StatCard } from '@goodboy/ui';
import { elapsedWordOf } from '../../central/board/boardRowWordsOf';
import { countNoun } from '../../../../shared/utils/countNoun';
import type { SessionKpis } from '../../central/board/sessionKpisOf';

type Props = {
  readonly kpis: SessionKpis;
};

export const BoardTiles = ({ kpis }: Props) => {
  const { branches } = kpis;
  const isAllMerged = branches.total > 0 && branches.merged === branches.total;
  return (
    <div data-slot="session-kpis" className="grid grid-cols-3 gap-4">
      <StatCard
        label="Branches"
        value={String(branches.merged)}
        unit={`of ${branches.total} merged`}
        {...(isAllMerged && { valueTone: 'success' as const })}
        reservesDeltaRow
      />
      <StatCard
        label="Spend"
        value={formatUsd(kpis.spendUsd)}
        hint={[
          kpis.leadCount === 0 ? '' : countNoun({ count: kpis.leadCount, one: 'Lead' }),
          countNoun({ count: kpis.agentCount, one: 'agent' }),
        ]
          .filter((part) => part !== '')
          .join(', ')}
        reservesDeltaRow
      />
      <StatCard
        label="Time"
        value={elapsedWordOf({ elapsedMs: kpis.elapsedMs })}
        hint="Agent time, all branches"
        reservesDeltaRow
      />
    </div>
  );
};
