import type { ProviderId } from '@goodboy/types';
import { PROVIDER_BRAND } from '../../../features/providers/components/provider-brand';
import {
  EFFORT_LABEL,
  modelLabel,
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
      <ProviderGlyph size={12} className="shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 truncate font-mono font-medium text-foreground">
        {modelLabel(model)}
        {modelDetail != null ? ` ${modelDetail}` : ''}
      </span>
      {showEffort && (
        <>
          <TriggerSeparator />
          <span className="shrink-0 text-muted-foreground">{EFFORT_LABEL[effort]}</span>
        </>
      )}
      {verbosity != null && (
        <>
          <TriggerSeparator />
          <span className="shrink-0 text-muted-foreground">{VERBOSITY_LABEL[verbosity]}</span>
        </>
      )}
    </>
  );
};
