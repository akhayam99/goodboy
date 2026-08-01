import { cn } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import { getModelProvider } from '@goodboy/core';
import { PROVIDER_BRAND, brandColor } from '../../../features/providers/components/provider-brand';
import {
  EFFORT_DOT,
  EFFORT_LABEL,
  EFFORT_TEXT,
  PROVIDER_LABEL,
  TIER_TEXT,
  clampEffort,
  modelLabel,
  modelTier,
  type EffortLevel,
} from '../../../features/chat/utils/chat-constants';
import { MODEL_COST_DOT, modelCostTier } from '../../../features/session/components/dropdown-utils';

type Props = {
  readonly provider?: string | null;
  readonly model?: string | null;
  readonly effort?: string | null;
  readonly variant?: 'compact' | 'full';
  readonly missingLabel?: string;
  readonly muted?: boolean;
  readonly className?: string;
};

const CHIP_CLASS =
  'inline-flex items-center gap-1 rounded-md bg-muted/50 px-1.5 py-0.5 text-2xs text-muted-foreground';

export const RoutingBadge = ({
  provider = null,
  model = null,
  effort = null,
  variant = 'compact',
  missingLabel = 'not resolved',
  muted = false,
  className,
}: Props) => {
  const named = provider ?? (model != null ? getModelProvider(model) : null);
  const resolvedProvider = named != null && named in PROVIDER_BRAND ? (named as ProviderId) : null;
  const providerLabel = resolvedProvider != null ? PROVIDER_LABEL[resolvedProvider] : named;
  const Glyph = resolvedProvider != null ? PROVIDER_BRAND[resolvedProvider].icon : null;
  const level = effort != null && effort in EFFORT_LABEL ? (effort as EffortLevel) : null;
  const resolvedEffort = model != null && level != null ? clampEffort(model, level) : level;
  const glyphSize = variant === 'full' ? 12 : 11;

  if (variant === 'full') {
    return (
      <span className={cn('flex flex-wrap items-center gap-1.5', muted && 'opacity-60', className)}>
        {model != null && (
          <span className={cn(CHIP_CLASS, 'min-w-0 font-mono')} title={model}>
            <span
              className={cn('size-1.5 shrink-0 rounded-full', MODEL_COST_DOT[modelCostTier(model)])}
              aria-hidden
            />
            <span className="truncate">{modelLabel(model)}</span>
          </span>
        )}
        <span className={CHIP_CLASS}>
          {Glyph != null && resolvedProvider != null && (
            <Glyph
              size={glyphSize}
              className="shrink-0"
              style={{ color: brandColor(resolvedProvider) }}
              aria-hidden
            />
          )}
          {providerLabel ?? missingLabel}
        </span>
        {resolvedEffort != null && (
          <span className={CHIP_CLASS}>
            <span
              className={cn('size-1.5 shrink-0 rounded-full', EFFORT_DOT[resolvedEffort])}
              aria-hidden
            />
            {EFFORT_LABEL[resolvedEffort]}
          </span>
        )}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex min-w-0 items-center gap-1 text-2xs',
        muted && 'opacity-60',
        className,
      )}
    >
      {model != null ? (
        <span
          className={cn('min-w-0 truncate font-medium', TIER_TEXT[modelTier(model)])}
          title={`model: ${model}`}
        >
          {modelLabel(model)}
        </span>
      ) : (
        <span className="text-muted-foreground/50">{missingLabel}</span>
      )}
      {Glyph != null && resolvedProvider != null && (
        <Glyph
          size={glyphSize}
          className="shrink-0"
          style={{ color: brandColor(resolvedProvider) }}
          aria-hidden
        />
      )}
      {model != null && resolvedEffort != null && (
        <span className={cn('shrink-0', EFFORT_TEXT[resolvedEffort])} title="effort">
          {EFFORT_LABEL[resolvedEffort]}
        </span>
      )}
    </span>
  );
};
