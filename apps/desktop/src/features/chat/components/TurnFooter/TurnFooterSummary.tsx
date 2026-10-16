import { WorkNode, type WorkNodeState } from '@goodboy/ui';
import { providerIdOf } from '../../../../shared/utils/providerIdOf';
import { modelLabel } from '../../utils/chat-constants';
import { ProviderGlyph } from '../../../../shared/components/RoutingPicker/ProviderGlyph';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { TurnFooterData } from './useTurnFooter';

type Outcome = Readonly<{
  state: WorkNodeState;
  label: string;
}>;

type Props = {
  readonly data: TurnFooterData;
  readonly duration: string | null;
  readonly outcome?: Outcome | null;
};

export const TurnFooterSummary = ({ data, duration, outcome = null }: Props) => {
  const provider = providerIdOf({ value: data.provider });

  return (
    <>
      {outcome === null ? null : (
        <WorkNode size="sm" state={outcome.state} mark={{ kind: 'dot' }} label={outcome.label} />
      )}
      {provider !== null && <ProviderGlyph id={provider} size={ICON_SIZE.row} />}
      {data.model != null && <span>{modelLabel(data.model, provider)}</span>}
      {duration != null && <span className="text-faint-foreground">{duration}</span>}
    </>
  );
};
