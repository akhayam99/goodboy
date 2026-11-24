import type { ReactNode } from 'react';
import { formatUsd } from '@goodboy/ui';
import type { AgentRowWork } from '../../../../hooks/useAgentRowWork';
import type { TimelineAgentEntry } from '../../../../timeline/buildTimelineGroups';
import type { AgentRowModels } from './useAgentRowModels';
import { RowModelsCard } from './RowModelsCard';
import { TimelineModelCell } from './TimelineModelCell';
import { TimelineRowMeta, type TimelineRowMetaLayout } from './TimelineRowMeta';

type Props = {
  readonly entry: TimelineAgentEntry;
  readonly ordinal: string | null;
  readonly work: AgentRowWork;
  readonly rowModels: AgentRowModels;
  readonly costUsd: number;
  readonly isRunning: boolean;
  readonly layout?: TimelineRowMetaLayout;
  readonly state?: ReactNode;
};

export const AgentRowMeta = ({
  entry,
  ordinal,
  work,
  rowModels,
  costUsd,
  isRunning,
  layout = 'stack',
  state = null,
}: Props) => {
  const { models, summary, kindWord } = rowModels;
  return (
    <TimelineRowMeta
      layout={layout}
      state={state}
      isLive={isRunning}
      model={
        <TimelineModelCell
          summary={summary}
          isPlanned={models.isPlanned}
          isFluid={layout === 'feed'}
          wrapCard={
            summary === null
              ? null
              : ({ children }) => (
                  <RowModelsCard
                    entry={entry}
                    ordinal={ordinal}
                    kindWord={kindWord}
                    models={models}
                  >
                    {children}
                  </RowModelsCard>
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
