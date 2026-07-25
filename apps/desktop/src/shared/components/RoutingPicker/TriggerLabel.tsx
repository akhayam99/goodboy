import { cn } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import { PROVIDER_BRAND, brandColor } from '../../../features/providers/components/provider-brand';
import {
  EFFORT_LABEL,
  EFFORT_TEXT,
  PROVIDER_LABEL,
  PROVIDER_TEXT,
  TIER_TEXT,
  VERBOSITY_TEXT,
  modelLabel,
  modelTier,
  type EffortLevel,
} from '../../../features/chat/utils/chat-constants';
import { VERBOSITY_LABEL, type VerbosityLevel } from '../../../features/settings/verbosity';
import { TriggerSeparator } from './TriggerSeparator';

type Props = {
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: EffortLevel;
  readonly showEffort: boolean;
  readonly isModelRecommended: boolean;
  readonly verbosity?: VerbosityLevel;
};

export const TriggerLabel = ({
  provider,
  model,
  effort,
  showEffort,
  isModelRecommended,
  verbosity,
}: Props) => {
  const ProviderGlyph = PROVIDER_BRAND[provider].icon;
  return (
    <>
      <ProviderGlyph
        size={12}
        className="shrink-0"
        style={{ color: brandColor(provider) }}
        aria-hidden
      />
      <span className={cn('shrink-0 font-medium', PROVIDER_TEXT[provider])}>
        {PROVIDER_LABEL[provider]}
      </span>
      <TriggerSeparator />
      <span className={cn('min-w-0 truncate font-mono font-medium', TIER_TEXT[modelTier(model)])}>
        {modelLabel(model)}
      </span>
      {showEffort && (
        <>
          <TriggerSeparator />
          <span className={cn('shrink-0', EFFORT_TEXT[effort])}>{EFFORT_LABEL[effort]}</span>
        </>
      )}
      {verbosity != null && (
        <>
          <TriggerSeparator />
          <span className={cn('shrink-0', VERBOSITY_TEXT[verbosity])}>
            {VERBOSITY_LABEL[verbosity]}
          </span>
        </>
      )}
      {isModelRecommended && (
        <span className="shrink-0 rounded bg-muted px-1 text-[9px] font-medium uppercase leading-tight tracking-wide text-muted-foreground/70">
          recommended
        </span>
      )}
    </>
  );
};
