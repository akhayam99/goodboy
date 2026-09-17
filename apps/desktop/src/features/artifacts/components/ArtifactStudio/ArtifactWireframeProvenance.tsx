import { useMemo } from 'react';
import { parseWireframeSource } from '@goodboy/core';
import type { WireframeArtifact } from '@goodboy/types';
import { WireframeProvenanceRow } from '../../../wireframes/components/WireframeStudio/WireframeProvenanceRow';
import { asWireframeFidelity } from '../../../wireframes/wireframeFidelity';

type Props = {
  readonly artifact: WireframeArtifact;
};

export const ArtifactWireframeProvenance = ({ artifact }: Props) => {
  const parsed = useMemo(
    () => parseWireframeSource({ source: artifact.sourceText }),
    [artifact.sourceText],
  );

  return (
    <WireframeProvenanceRow
      fidelity={asWireframeFidelity({ value: artifact.metadata.fidelity }) ?? 'low'}
      theme={parsed.status === 'invalid' ? { name: 'generic' } : parsed.document.theme}
      designProfile={artifact.metadata.designProfile}
    />
  );
};
