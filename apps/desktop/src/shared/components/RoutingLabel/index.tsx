import { Fragment } from 'react';
import { Tooltip, WORK_META_COLUMN, cn } from '@goodboy/ui';
import { PROVIDER_BRAND, brandColor } from '../../../features/providers/components/provider-brand';
import { TriggerSeparator } from '../RoutingPicker/TriggerSeparator';
import { routingNameText } from '../RoutingPicker/routingSummary';
import { routingLabelModel, type PlannedRouting } from './routingLabelModel';

type Props = {
  readonly provider?: string | null;
  readonly model?: string | null;
  readonly effort?: string | null;
  readonly planned?: PlannedRouting | null;
  readonly isEffortObserved?: boolean;
  readonly isColumn?: boolean;
  readonly glyphPlacement?: 'leading' | 'trailing';
  readonly muted?: boolean;
  readonly className?: string;
};

const MISSING_LABEL = 'Model not chosen yet';

const DIVERGED_CLASS = 'underline decoration-dotted underline-offset-2';

export const RoutingLabel = ({
  provider = null,
  model = null,
  effort = null,
  planned = null,
  isEffortObserved = false,
  isColumn = false,
  glyphPlacement = 'leading',
  muted = false,
  className,
}: Props) => {
  const shown = routingLabelModel({ provider, model, effort, planned, isEffortObserved });
  const Glyph = shown.provider != null ? PROVIDER_BRAND[shown.provider].icon : null;
  const glyph =
    Glyph != null && shown.provider != null ? (
      <Glyph
        size={isColumn ? 12 : 11}
        className="shrink-0"
        style={{ color: brandColor(shown.provider) }}
        aria-hidden
      />
    ) : null;

  if (isColumn) {
    if (shown.label == null) {
      return <span aria-hidden className={cn(WORK_META_COLUMN.routing, className)} />;
    }
    const detail = shown.label.detail[0] ?? null;
    return (
      <Tooltip content={shown.tooltip}>
        <span
          data-meta-column="routing"
          data-testid={shown.isDiverged ? 'routing-divergence' : undefined}
          className={cn(WORK_META_COLUMN.routing, shown.isDiverged && DIVERGED_CLASS, className)}
        >
          {glyph}
          <span
            data-routing-part="name"
            data-model-id={model ?? undefined}
            className={WORK_META_COLUMN.routingName}
          >
            {routingNameText(shown.label)}
          </span>
          {detail != null && (
            <span
              className={cn(
                WORK_META_COLUMN.routingDetail,
                !isEffortObserved && 'text-faint-foreground',
              )}
            >
              <TriggerSeparator />
              <span data-routing-part="detail">{detail}</span>
            </span>
          )}
        </span>
      </Tooltip>
    );
  }

  if (shown.label == null) {
    return (
      <span className={cn('inline-flex min-w-0 items-center gap-1 text-secondary', className)}>
        <span className="text-faint-foreground">{MISSING_LABEL}</span>
      </span>
    );
  }
  return (
    <Tooltip content={shown.tooltip}>
      <span
        data-testid={shown.isDiverged ? 'routing-divergence' : undefined}
        className={cn(
          'inline-flex min-w-0 items-center gap-1 text-secondary',
          muted && 'opacity-60',
          shown.isDiverged && DIVERGED_CLASS,
          className,
        )}
      >
        {glyphPlacement === 'leading' ? glyph : null}
        <span
          data-routing-part="name"
          data-model-id={model ?? undefined}
          className="min-w-0 truncate font-mono font-medium text-foreground"
        >
          {routingNameText(shown.label)}
        </span>
        {shown.label.detail.map((segment) => (
          <Fragment key={segment}>
            <TriggerSeparator />
            <span data-routing-part="detail" className="shrink-0 text-muted-foreground">
              {segment}
            </span>
          </Fragment>
        ))}
        {glyphPlacement === 'trailing' ? glyph : null}
      </span>
    </Tooltip>
  );
};
