import { ModelBlock, Tooltip, WORK_META_COLUMN, cn } from '@goodboy/ui';
import { PROVIDER_BRAND, brandColor } from '../../../features/providers/components/provider-brand';
import { routingNameText } from '../RoutingPicker/routingSummary';
import { routingLabelModel, type PlannedRouting } from '../RoutingLabel/routingLabelModel';

type Props = {
  readonly provider?: string | null;
  readonly model?: string | null;
  readonly effort?: string | null;
  readonly planned?: PlannedRouting | null;
  readonly isEffortObserved?: boolean;
  readonly isPlanned?: boolean;
};

const GLYPH_SIZE = 14;

const DIVERGED_CLASS = 'underline decoration-dotted underline-offset-2';

export const RoutingModelBlock = ({
  provider = null,
  model = null,
  effort = null,
  planned = null,
  isEffortObserved = false,
  isPlanned = false,
}: Props) => {
  const shown = routingLabelModel({ provider, model, effort, planned, isEffortObserved });
  if (shown.label == null) {
    return <span aria-hidden data-meta-column="model" className={WORK_META_COLUMN.model} />;
  }
  const Glyph = shown.provider === null ? null : PROVIDER_BRAND[shown.provider].icon;
  const glyphs =
    Glyph === null || shown.provider === null
      ? []
      : [
          {
            key: shown.provider,
            node: (
              <Glyph
                size={GLYPH_SIZE}
                className="shrink-0"
                style={{ color: brandColor(shown.provider) }}
                aria-hidden
              />
            ),
          },
        ];
  return (
    <Tooltip content={shown.tooltip}>
      <ModelBlock
        testId={shown.isDiverged ? 'routing-divergence' : undefined}
        className={cn(shown.isDiverged && DIVERGED_CLASS)}
        isPlanned={isPlanned}
        glyphs={glyphs}
        name={routingNameText(shown.label)}
        detail={shown.label.detail[0] ?? null}
      />
    </Tooltip>
  );
};
