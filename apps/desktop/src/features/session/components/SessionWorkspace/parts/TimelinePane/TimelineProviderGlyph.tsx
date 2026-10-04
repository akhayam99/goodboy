import { PROVIDER_IDS } from '@goodboy/types';
import { ProviderGlyph } from '../../../../../../shared/components/RoutingPicker/ProviderGlyph';
import { PROVIDER_LABEL } from '../../../../../providers/providerLabel';

type Props = {
  readonly provider: string | null | undefined;
};

export const TimelineProviderGlyph = ({ provider }: Props) => {
  const id = PROVIDER_IDS.find((candidate) => candidate === provider);
  if (id === undefined) {
    return null;
  }
  return (
    <span data-provider={id} className="inline-flex shrink-0 items-center self-center opacity-40">
      <ProviderGlyph id={id} size={11} />
      <span className="sr-only">{PROVIDER_LABEL[id]}</span>
    </span>
  );
};
