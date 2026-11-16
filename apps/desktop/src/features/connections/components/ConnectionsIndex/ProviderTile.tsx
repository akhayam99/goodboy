import {
  MODEL_CATALOGS,
  PROVIDERS_REPORTING_LIMITS,
  isApiProvider,
  limitsChipOf,
  parseHiddenModels,
  visibleModelCount,
} from '@goodboy/core/providers';
import type { ProviderId } from '@goodboy/types';
import { ProviderGlyph } from '../../../../shared/components/RoutingPicker/ProviderGlyph';
import { useAppStore } from '../../../../store';
import { CLI_LABEL } from '../../../providers/cliLabel';
import { planLabelOf } from '../../../providers/planLabelOf';
import { SETTING_HIDDEN_MODELS } from '../../../settings/settings';
import { connectionStateOf } from '../../model/connectionStateOf';
import { ConnectionTile } from './ConnectionTile';
import { UsageMeters } from './UsageMeters';

type Props = {
  readonly providerId: ProviderId;
  readonly nowMs: number;
  readonly onOpen: () => void;
};

type LineParams = {
  readonly label: string;
  readonly isKeyed: boolean;
  readonly isReportingLimits: boolean;
};

const usageLineOf = ({ label, isKeyed, isReportingLimits }: LineParams): string => {
  if (isReportingLimits) {
    return 'No usage reported yet';
  }
  return isKeyed ? 'Billed per token by your key' : `${label} doesn't share usage`;
};

export const ProviderTile = ({ providerId, nowMs, onOpen }: Props) => {
  const provider = useAppStore((state) =>
    state.providers.find((candidate) => candidate.id === providerId),
  );
  const limits = useAppStore((state) => state.providerLimits[providerId]);
  const health = useAppStore((state) => state.providerHealth[providerId]);
  const cliRequirements = useAppStore((state) => state.cliRequirements);
  const authPlan = useAppStore((state) => state.authResults?.[providerId]?.plan ?? null);
  const hiddenRaw = useAppStore((state) => state.settings?.[SETTING_HIDDEN_MODELS] ?? null);
  if (provider === undefined) {
    return null;
  }
  const state = connectionStateOf({
    subject: {
      kind: 'provider',
      provider,
      state: {
        cliRequirements,
        providerLimits: { [providerId]: limits },
        providerHealth: { [providerId]: health },
      },
      nowMs,
    },
  });
  const isKeyed = isApiProvider({ id: providerId });
  const chip = limitsChipOf({ providerId, limits, nowMs });
  const windows = chip.windows;
  const plan = planLabelOf({ authPlan, limitsPlan: limits?.plan });
  const account = [plan === null ? null : `${plan} plan`, provider.identity].filter(
    (part): part is string => part !== null && part !== '',
  );
  const shown = visibleModelCount({ provider: providerId, hidden: parseHiddenModels(hiddenRaw) });
  const total = MODEL_CATALOGS[providerId].length;
  const fallbackAccount = isKeyed ? 'API key' : CLI_LABEL[providerId];

  return (
    <ConnectionTile
      id={providerId}
      glyph={<ProviderGlyph id={providerId} />}
      name={provider.label}
      state={state}
      onOpen={onOpen}
    >
      <span className="truncate text-meta text-foreground">
        {account.length > 0 ? account.join(' · ') : fallbackAccount}
      </span>
      {windows.length > 0 ? (
        <UsageMeters windows={windows} />
      ) : (
        <span className="text-meta text-muted-foreground">
          {usageLineOf({
            label: provider.label,
            isKeyed,
            isReportingLimits: PROVIDERS_REPORTING_LIMITS.includes(providerId),
          })}
        </span>
      )}
      <span className="text-meta text-faint-foreground">
        {shown} of {total} models in the picker
      </span>
    </ConnectionTile>
  );
};
