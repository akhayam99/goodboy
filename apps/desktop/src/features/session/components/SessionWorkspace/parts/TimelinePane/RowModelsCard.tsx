import { AgentKindChip } from '../../../../../../shared/components/AgentKindChip';
import { formatClock } from '../../../../../../shared/utils/time/formatClock';
import type { TimelineAgentEntry } from '../../../../timeline/buildTimelineGroups';
import type { AgentModels, RanModel } from '../../../../timeline/ranModels';
import { RowCardHeader } from './RowCardHeader';
import { TimelineProviderGlyph } from './TimelineProviderGlyph';
import { useRowPosition } from './useRowPosition';

type Props = {
  readonly entry: TimelineAgentEntry;
  readonly ordinal: string | null;
  readonly kindWord: string;
  readonly models: AgentModels;
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

export const RowModelsCard = ({ entry, ordinal, kindWord, models }: Props) => {
  const position = useRowPosition({ entry, ordinal });
  return (
    <span className="flex flex-col gap-2">
      <RowCardHeader
        glyph={<AgentKindChip kind={entry.agentKind} density="glyph" isDecorative />}
        title={kindWord}
        sub={position}
      />
      <span className="text-eyebrow text-faint-foreground">Models, in run order</span>
      <ol className="flex flex-col gap-2">
        {models.models.map((model, index) => (
          <li key={`${model.key}:${index}`} className="flex items-start gap-2">
            <TimelineProviderGlyph provider={model.provider} />
            <span className="flex min-w-0 flex-col">
              <span className="text-body text-foreground">
                {model.effort === null ? model.name : `${model.name} · ${model.effort}`}
              </span>
              <span className="text-meta text-muted-foreground">
                {reasonOf({ model, isPlanned: models.isPlanned })}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </span>
  );
};
