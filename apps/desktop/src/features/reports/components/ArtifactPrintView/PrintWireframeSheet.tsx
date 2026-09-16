import type { WireframeDocument } from '@goodboy/core';
import type { WireframeArtifact } from '@goodboy/types';
import { WireframeContactSheet } from '../../../wireframes/components/WireframeContactSheet';
import { isWideContactSheet } from '../../../wireframes/contactSheetLayout';
import { asWireframeFidelity } from '../../../wireframes/wireframeFidelity';
import { wireframePalette } from '../../../wireframes/wireframePalette';
import { artifactMetaFields } from './artifactMetaFields';
import { PrintLetterhead } from './PrintLetterhead';
import { PRINT_LANDSCAPE_CSS } from './printSheetCss';

type Props = {
  readonly artifact: WireframeArtifact;
  readonly document: WireframeDocument;
};

export const PrintWireframeSheet = ({ artifact, document }: Props) => {
  const fidelity = asWireframeFidelity({ value: artifact.metadata.fidelity }) ?? 'low';
  const palette = wireframePalette({ theme: document.theme, fidelity });
  const isWide = isWideContactSheet({ screens: document.screens });
  return (
    <article data-testid="print-wireframe-sheet" data-page={isWide ? 'landscape' : 'portrait'}>
      {isWide ? <style>{PRINT_LANDSCAPE_CSS}</style> : null}
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
