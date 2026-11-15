import { formatUsd, StatCard } from '@goodboy/ui';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import { elapsedWordOf } from '../../central/board/boardRowWordsOf';
import { countWordOf } from '../../central/board/countWordOf';
import type { OverviewTileFacts } from '../../central/board/overviewTileFactsOf';
import type { SessionKpis } from '../../central/board/sessionKpisOf';
import type { BoardFilter } from '../../central/board/visibleGroupsOf';

type FilterParams = {
  readonly filter: BoardFilter | null;
};

type Props = {
  readonly kpis: SessionKpis;
  readonly facts: OverviewTileFacts;
  readonly now: number;
  readonly filter: BoardFilter | null;
  readonly onFilter: (params: FilterParams) => void;
};

export const BoardTiles = ({ kpis, facts, now, filter, onFilter }: Props) => {
  const { branches } = kpis;
  const isAllMerged = branches.total > 0 && branches.merged === branches.total;
  const newestAge =
    facts.newestArtifactAt === null ? '' : formatAge({ from: facts.newestArtifactAt, now });
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
        label="Questions"
        value={String(facts.openQuestions)}
        {...(facts.openQuestions > 0 && { valueTone: 'warning' as const })}
        {...(facts.blockingQuestions > 0 && {
          hint: `${facts.blockingQuestions} blocking`,
        })}
        isPressed={filter === 'questions'}
        reservesDeltaRow
        onClick={() => onFilter({ filter: filter === 'questions' ? null : 'questions' })}
      />
      <StatCard
        label="Artifacts"
        value={String(facts.artifacts)}
        {...(newestAge !== '' && { hint: `Newest ${newestAge}` })}
        reservesDeltaRow
      />
      <StatCard
        label="Spend"
        value={formatUsd(kpis.spendUsd)}
        hint={[
          kpis.leadCount === 0 ? '' : countWordOf({ count: kpis.leadCount, noun: 'Lead' }),
          countWordOf({ count: kpis.agentCount, noun: 'agent' }),
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
