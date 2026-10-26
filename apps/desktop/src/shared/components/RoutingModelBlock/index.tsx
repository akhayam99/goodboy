import { FactCard, ICON_SIZE, ModelBlock, WORK_META_COLUMN, cn } from '@goodboy/ui';
import { ProviderGlyph } from '../RoutingPicker/ProviderGlyph';
import { routingNameText } from '../RoutingPicker/routingSummary';
import { routingLabelModel, type PlannedRouting } from '../RoutingLabel/routingLabelModel';

type Props = {
  readonly provider?: string | null;
  readonly model?: string | null;
  readonly effort?: string | null;
  readonly planned?: PlannedRouting | null;
  readonly isEffortObserved?: boolean;
  readonly isPlanned?: boolean;
  readonly layout?: 'column' | 'inline';
};

const DIVERGED_CLASS = 'underline decoration-dotted underline-offset-2';

export const RoutingModelBlock = ({
  provider = null,
  model = null,
  effort = null,
  planned = null,
  isEffortObserved = false,
  isPlanned = false,
  layout = 'column',
}: Props) => {
  const shown = routingLabelModel({ provider, model, effort, planned, isEffortObserved });
  if (shown.label == null || shown.card === null) {
    return <span aria-hidden data-meta-column="model" className={WORK_META_COLUMN.model} />;
  }
  const glyphs =
    shown.provider === null
      ? []
      : [
          {
            key: shown.provider,
            node: <ProviderGlyph id={shown.provider} size={ICON_SIZE.control} />,
          },
        ];
  return (
    <FactCard card={shown.card}>
      <ModelBlock
        testId={shown.isDiverged ? 'routing-divergence' : undefined}
        className={cn(shown.isDiverged && DIVERGED_CLASS)}
        isPlanned={isPlanned}
        layout={layout}
        glyphs={glyphs}
        name={routingNameText(shown.label)}
        detail={shown.label.detail[0] ?? null}
      />
    </FactCard>
  );
};
