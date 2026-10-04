import { useContext } from 'react';
import { PROVIDER_IDS } from '@goodboy/types';
import { ProviderGlyph } from '../../../../../../shared/components/RoutingPicker/ProviderGlyph';
import { PROVIDER_LABEL } from '../../../../../providers/providerLabel';
import { TimelineRouting, isProviderGlyphShown } from './timelineRouting';

type Props = {
  readonly provider: string | null | undefined;
};

export const TimelineProviderGlyph = ({ provider }: Props) => {
  const facts = useContext(TimelineRouting);
  const id = PROVIDER_IDS.find((candidate) => candidate === provider);
  if (id === undefined || !isProviderGlyphShown({ facts })) {
    return null;
  }
  return (
    <span data-provider={id} className="inline-flex shrink-0 items-center self-center opacity-40">
      <ProviderGlyph id={id} size={11} />
      <span className="sr-only">{PROVIDER_LABEL[id]}</span>
    </span>
  );
};
