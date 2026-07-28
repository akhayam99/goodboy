import { cn } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import { PROVIDER_BRAND, brandColor } from '../../../features/providers/components/provider-brand';
import {
  EFFORT_LABEL,
  EFFORT_TEXT,
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
  readonly modelDetail?: string;
  readonly effort: EffortLevel;
  readonly showEffort: boolean;
  readonly verbosity?: VerbosityLevel;
};

export const TriggerLabel = ({
  provider,
  model,
  modelDetail,
  effort,
  showEffort,
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
      <span className={cn('min-w-0 truncate font-mono font-medium', TIER_TEXT[modelTier(model)])}>
        {modelLabel(model)}
        {modelDetail != null ? ` ${modelDetail}` : ''}
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
    </>
  );
};
