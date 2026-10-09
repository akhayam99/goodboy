import { formatUsd } from '@goodboy/ui';
import type { AgentRowWork } from '../../../../hooks/useAgentRowWork';
import type { TimelineAgentEntry } from '../../../../timeline/buildTimelineGroups';
import type { AgentRowModels } from './useAgentRowModels';
import { RowModelsCard } from './RowModelsCard';
import { TimelineModelCell } from './TimelineModelCell';
import { TimelineRowMeta } from './TimelineRowMeta';

type Props = {
  readonly entry: TimelineAgentEntry;
  readonly ordinal: string | null;
  readonly work: AgentRowWork;
  readonly rowModels: AgentRowModels;
  readonly costUsd: number;
  readonly isRunning: boolean;
};

export const AgentRowMeta = ({ entry, ordinal, work, rowModels, costUsd, isRunning }: Props) => {
  const { models, summary, kindWord } = rowModels;
  return (
    <TimelineRowMeta
      model={
        <TimelineModelCell
          summary={summary}
          isPlanned={models.isPlanned}
          card={
            summary === null ? null : (
              <RowModelsCard entry={entry} ordinal={ordinal} kindWord={kindWord} models={models} />
            )
          }
        />
      }
      time={work.time ?? null}
      cost={costUsd > 0 ? formatUsd(costUsd) : null}
      isPlanned={work.routing.isPlanned}
      note={isRunning ? (work.time?.note ?? null) : null}
    />
  );
};
