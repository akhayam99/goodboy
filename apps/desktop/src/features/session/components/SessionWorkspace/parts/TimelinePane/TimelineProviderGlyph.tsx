import { PROVIDER_IDS } from '@goodboy/types';
import { ICON_SIZE, cn } from '@goodboy/ui';
import { ProviderGlyph } from '../../../../../../shared/components/RoutingPicker/ProviderGlyph';
import { PROVIDER_LABEL } from '../../../../../providers/providerLabel';

type Props = {
  readonly provider: string | null | undefined;
  readonly isFaint?: boolean;
};

export const TimelineProviderGlyph = ({ provider, isFaint = false }: Props) => {
  const id = PROVIDER_IDS.find((candidate) => candidate === provider);
  if (id === undefined) {
    return null;
  }
  return (
    <span
      data-provider={id}
      className={cn('inline-flex shrink-0 items-center', isFaint ? 'opacity-40' : 'opacity-75')}
    >
      <ProviderGlyph id={id} size={ICON_SIZE.row} />
      <span className="sr-only">{PROVIDER_LABEL[id]}</span>
    </span>
  );
};
