import type { WireframeDocument } from '@goodboy/core';
import type { WireframeArtifact } from '@goodboy/types';
import { WireframeContactSheet } from '../../../wireframes/components/WireframeContactSheet';
import { asWireframeFidelity } from '../../../wireframes/wireframeFidelity';
import { wireframePalette } from '../../../wireframes/wireframePalette';
import { artifactMetaFields } from './artifactMetaFields';
import { PrintLetterhead } from './PrintLetterhead';
import type { PrintPage } from './printPage';

type Props = {
  readonly artifact: WireframeArtifact;
  readonly document: WireframeDocument;
  readonly page: PrintPage;
};

export const PrintWireframeSheet = ({ artifact, document, page }: Props) => {
  const fidelity = asWireframeFidelity({ value: artifact.metadata.fidelity }) ?? 'low';
  const palette = wireframePalette({ theme: document.theme, fidelity });
  return (
    <article className="print-document" data-testid="print-wireframe-sheet" data-page={page}>
      <PrintLetterhead
        kind={artifact.kind}
        title={artifact.title}
        fields={artifactMetaFields({ artifact })}
      />
      <WireframeContactSheet
        document={document}
        palette={palette}
        isLowFidelity={fidelity === 'low'}
        surface="print"
      />
    </article>
  );
};
