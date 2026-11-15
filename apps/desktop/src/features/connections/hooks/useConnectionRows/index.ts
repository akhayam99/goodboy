import { useMemo } from 'react';
import { isProviderId } from '@goodboy/types/helpers';
import type { Tone } from '@goodboy/ui';
import { useNow } from '../../../../shared/hooks/useNow';
import { integrationLabel } from '../../../../shared/utils/integrationLabel';
import { useAppStore } from '../../../../store';
import { TOOL_ORDER } from '../../../integrations/toolRailEntries';
import { orderProviders } from '../../../providers/orderProviders';
import { providerRailStatus } from '../../../providers/providerRailStatus';
import type { ConnectionRow, ConnectionRowStatus } from '../../connectionRow';

type Params = Record<never, never>;

type Rows = {
  readonly providers: ReadonlyArray<ConnectionRow>;
  readonly tools: ReadonlyArray<ConnectionRow>;
};

type StatusParams = {
  readonly label: string | undefined;
  readonly tone: Tone | undefined;
};

const STATUS_CLOCK_MS = 60_000;

const ATTENTION_TONES: ReadonlyArray<Tone> = ['info', 'warning', 'danger'];

const connectionStatusOf = ({ label, tone }: StatusParams): ConnectionRowStatus | null => {
  if (label === undefined || tone === undefined || !ATTENTION_TONES.includes(tone)) {
    return null;
  }
  return { label, tone };
};

const TOOL_ROWS: ReadonlyArray<ConnectionRow> = TOOL_ORDER.map((tool) => ({
  key: `tool:${tool}`,
  label: integrationLabel({ provider: tool }),
  status: null,
  target: { kind: 'tool', tool },
}));

export const useConnectionRows = ({}: Params): Rows => {
  const nowMs = useNow(STATUS_CLOCK_MS);
  const providers = useAppStore((state) => state.providers);
  const cliRequirements = useAppStore((state) => state.cliRequirements);
  const providerLimits = useAppStore((state) => state.providerLimits);
  const providerHealth = useAppStore((state) => state.providerHealth);

  const providerRows = useMemo(
    () =>
      orderProviders({ providers }).flatMap((provider): ReadonlyArray<ConnectionRow> => {
        const { id } = provider;
        if (!isProviderId(id)) {
          return [];
        }
        const status = providerRailStatus({
          provider,
          state: { cliRequirements, providerLimits, providerHealth },
          nowMs,
        });
        return [
          {
            key: `provider:${id}`,
            label: provider.label,
            status: connectionStatusOf({ label: status.subtitle, tone: status.tone }),
            target: { kind: 'settings', change: { scope: 'providers', provider: id } },
          },
        ];
      }),
    [providers, cliRequirements, providerLimits, providerHealth, nowMs],
  );

  return useMemo(() => ({ providers: providerRows, tools: TOOL_ROWS }), [providerRows]);
};
