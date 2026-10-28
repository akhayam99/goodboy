import { formatUsd, ICON_SIZE } from '@goodboy/ui';
import { providerIdOf } from '../../../../shared/utils/providerIdOf';
import { joinFacts } from '../../../../shared/utils/joinFacts';
import { modelLabel } from '../../utils/chat-constants';
import { ProviderIcon } from '../../../providers/components/ProviderIcon';
import type { TurnFooterData } from './useTurnFooter';

type Props = {
  readonly data: TurnFooterData;
  readonly contextPct: number | null;
};

const CENT = 0.005;

export const UsageStatsRow = ({ data, contextPct }: Props) => {
  const model =
    data.model == null ? null : modelLabel(data.model, providerIdOf({ value: data.provider }));
  const cost =
    data.estimatedCostUsd != null && data.estimatedCostUsd >= CENT
      ? formatUsd(data.estimatedCostUsd)
      : null;
  const premium =
    data.premiumRequests === null
      ? null
      : `${data.premiumRequests} premium ${data.premiumRequests === 1 ? 'request' : 'requests'}`;
  const context =
    contextPct === null || Math.round(contextPct * 100) === 0
      ? null
      : `context ${Math.round(contextPct * 100)}%`;
  return (
    <>
      <ProviderIcon provider={data.provider} size={ICON_SIZE.row} />
      <span>{joinFacts({ facts: [model, cost, premium, context] })}</span>
    </>
  );
};
