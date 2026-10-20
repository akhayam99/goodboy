import { FactCard, type Fact } from '@goodboy/ui';
import { AgentKindChip } from '../../../../../../shared/components/AgentKindChip';
import { formatClock } from '../../../../../../shared/utils/time/formatClock';
import type { TimelineAgentEntry } from '../../../../timeline/buildTimelineGroups';
import type { AgentModels, RanModel } from '../../../../timeline/ranModels';
import { fitCardRows } from '../../../../../../shared/utils/fitCardRows';
import type { CardTrigger } from './timelineRowIdentity';
import { useRowPosition } from './useRowPosition';

type Props = {
  readonly entry: TimelineAgentEntry;
  readonly ordinal: string | null;
  readonly kindWord: string;
  readonly models: AgentModels;
  readonly isOpen?: boolean;
  readonly children: CardTrigger;
};

type ReasonParams = {
  readonly model: RanModel;
  readonly isPlanned: boolean;
};

const reasonOf = ({ model, isPlanned }: ReasonParams): string => {
  if (model.endReason === null || model.endedAtMs === null) {
    return isPlanned ? 'Planned, not started' : 'Running';
  }
  const at = formatClock({ at: model.endedAtMs });
  switch (model.endReason) {
    case 'succeeded':
      return `Finished ${at}`;
    case 'failed':
      return `Stopped, failed at ${at}`;
    case 'cancelled':
      return `Stopped at ${at}`;
    case 'awaiting_user':
      return `Needs you since ${at}`;
    default: {
      const exhaustive: never = model.endReason;
      return exhaustive;
    }
  }
};

export const RowModelsCard = ({
  entry,
  ordinal,
  kindWord,
  models,
  isOpen = false,
  children,
}: Props) => {
  const position = useRowPosition({ entry, ordinal });
  const seen = new Map<string, number>();
  const facts: Array<Fact> = models.models.map((model) => {
    const base = model.effort === null ? model.name : `${model.name} ${model.effort}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return {
      label: count === 1 ? base : `${base} (${count})`,
      value: reasonOf({ model, isPlanned: models.isPlanned }),
    };
  });
  const fitted = fitCardRows({ facts });
  return (
    <FactCard
      isOpen={isOpen}
      card={{
        glyph: <AgentKindChip kind={entry.agentKind} density="glyph" isDecorative />,
        title: kindWord,
        sub: position,
        facts: fitted.facts,
        ...(fitted.footnote === undefined ? {} : { footnote: fitted.footnote }),
      }}
    >
      {children}
    </FactCard>
  );
};
