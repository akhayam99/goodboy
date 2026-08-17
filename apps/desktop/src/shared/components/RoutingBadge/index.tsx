import { cn } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import { getModelProvider } from '@goodboy/core';
import { PROVIDER_BRAND, brandColor } from '../../../features/providers/components/provider-brand';
import {
  EFFORT_LABEL,
  PROVIDER_LABEL,
  clampEffort,
  modelLabel,
  type EffortLevel,
} from '../../../features/chat/utils/chat-constants';

type Props = {
  readonly provider?: string | null;
  readonly model?: string | null;
  readonly effort?: string | null;
  readonly variant?: 'compact' | 'full';
  readonly glyphPlacement?: 'leading' | 'trailing';
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
  glyphPlacement = 'leading',
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
        {model != null && (
          <span className={cn(CHIP_CLASS, 'min-w-0 font-mono')} title={model}>
            <span className="truncate">{modelLabel(model)}</span>
          </span>
        )}
        {resolvedEffort != null && (
          <span className={CHIP_CLASS}>{EFFORT_LABEL[resolvedEffort]}</span>
        )}
      </span>
    );
  }

  const glyph =
    Glyph != null && resolvedProvider != null ? (
      <Glyph
        size={glyphSize}
        className="shrink-0"
        style={{ color: brandColor(resolvedProvider) }}
        aria-hidden
      />
    ) : null;

  return (
    <span
      className={cn(
        'inline-flex min-w-0 items-center gap-1 text-2xs',
        muted && 'opacity-60',
        className,
      )}
    >
      {glyphPlacement === 'leading' ? glyph : null}
      {model != null ? (
        <span
          className="min-w-0 truncate font-mono font-medium text-foreground"
          title={`Model: ${model}`}
        >
          {modelLabel(model)}
        </span>
      ) : (
        <span className="text-muted-foreground/50">{missingLabel}</span>
      )}
      {model != null && resolvedEffort != null && (
        <span className="shrink-0 text-muted-foreground" title="Effort">
          {EFFORT_LABEL[resolvedEffort]}
        </span>
      )}
      {glyphPlacement === 'trailing' ? glyph : null}
    </span>
  );
};
