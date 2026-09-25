import type { SessionArtifact } from '@goodboy/types';
import { Markdown } from '@goodboy/ui';
import { artifactMetaFields } from '../../../reports/components/ArtifactReaderView/artifactMetaFields';
import {
  CONTENTS_MIN_SECTIONS,
  documentOutline,
} from '../../../reports/components/ArtifactReaderView/documentOutline';
import { dropLeadingTitleHeading } from '../../../reports/components/ArtifactReaderView/dropLeadingTitleHeading';
import { PrintContents } from '../../../reports/components/ArtifactReaderView/PrintContents';
import { PrintLetterhead } from '../../../reports/components/ArtifactReaderView/PrintLetterhead';
import { splitLead } from '../../../reports/components/ArtifactReaderView/splitLead';
import './artifactDocument.css';

export type ArtifactDocumentMedium = 'window' | 'paper' | 'file';

type Props = {
  readonly artifact: SessionArtifact;
  readonly medium: ArtifactDocumentMedium;
};

export const ArtifactDocument = ({ artifact, medium }: Props) => {
  const body = dropLeadingTitleHeading({
    sourceText: artifact.sourceText,
    title: artifact.title,
  });
  const { lead, rest } = splitLead({ sourceText: body });
  const sections = documentOutline({ sourceText: rest });
  return (
    <article data-testid="artifact-document" data-medium={medium} className="print-document">
      <PrintLetterhead
        kind={artifact.kind}
        title={artifact.title}
        fields={artifactMetaFields({ artifact })}
        hasMark={medium !== 'file'}
      />
      {lead.length > 0 ? (
        <div className="print-body print-lead">
          <Markdown text={lead} />
        </div>
      ) : null}
      {sections.length >= CONTENTS_MIN_SECTIONS ? <PrintContents sections={sections} /> : null}
      <div className="print-body">
        <Markdown text={rest} />
      </div>
    </article>
  );
};
