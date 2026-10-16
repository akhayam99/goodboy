import { Info } from 'lucide-react';
import { formatUsd } from '@goodboy/ui';
import { providerIdOf } from '../../../../shared/utils/providerIdOf';
import { modelLabel } from '../../utils/chat-constants';
import { ProviderGlyph } from '../../../../shared/components/RoutingPicker/ProviderGlyph';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { TurnFooterData } from './useTurnFooter';

type Props = {
  readonly data: TurnFooterData;
  readonly duration: string | null;
};

export const TurnFooterSummary = ({ data, duration }: Props) => {
  const provider = providerIdOf({ value: data.provider });

  return (
    <>
      {provider !== null && <ProviderGlyph id={provider} size={ICON_SIZE.row} />}
      {data.model != null && <span>{modelLabel(data.model, provider)}</span>}
      {duration != null && <span className="text-faint-foreground">{duration}</span>}
      {data.estimatedCostUsd != null && <span>~{formatUsd(data.estimatedCostUsd)}</span>}
      <Info size={ICON_SIZE.row} aria-hidden />
    </>
  );
};
