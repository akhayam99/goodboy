import type { WireframeDocument } from '@goodboy/core';
import type { WireframeArtifact } from '@goodboy/types';
import { artifactMetaFields } from '../../../artifacts/components/ArtifactDocument/artifactMetaFields';
import { PrintLetterhead } from '../../../artifacts/components/ArtifactDocument/PrintLetterhead';
import { WireframeContactSheet } from '../../../wireframes/components/WireframeContactSheet';
import { asWireframeFidelity } from '../../../wireframes/wireframeFidelity';
import { wireframePalette } from '../../../wireframes/wireframePalette';
import type { PrintPage } from './printPage';

type Props = {
  readonly artifact: WireframeArtifact;
  readonly document: WireframeDocument;
  readonly page: PrintPage;
  readonly medium: 'window' | 'paper';
};

export const PrintWireframeSheet = ({ artifact, document, page, medium }: Props) => {
  const fidelity = asWireframeFidelity({ value: artifact.metadata.fidelity }) ?? 'low';
  const palette = wireframePalette({ theme: document.theme, fidelity });
  const meta = artifactMetaFields({ artifact, workspaceName: '' });
  return (
    <article
      className="print-document"
      data-testid="print-wireframe-sheet"
      data-page={page}
      data-medium={medium}
    >
      <PrintLetterhead
        eyebrowLabel={meta.eyebrowLabel}
        dateLabel={meta.dateLabel}
        title={artifact.title}
      />
      <WireframeContactSheet document={document} palette={palette} surface="print" />
    </article>
  );
};
