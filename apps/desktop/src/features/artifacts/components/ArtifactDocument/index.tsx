import type { SessionArtifact } from '@goodboy/types';
import { Markdown } from '@goodboy/ui';
import { artifactMetaFields } from './artifactMetaFields';
import { CONTENTS_MIN_SECTIONS, documentOutline } from './documentOutline';
import { dropLeadingTitleHeading } from './dropLeadingTitleHeading';
import { PrintContents } from './PrintContents';
import { PrintLetterhead } from './PrintLetterhead';
import { splitLead } from './splitLead';
import './artifactDocument.css';

export type ArtifactDocumentMedium = 'screen' | 'file';

type Props = {
  readonly artifact: SessionArtifact;
  readonly medium: ArtifactDocumentMedium;
  readonly workspaceName: string;
};

export const ArtifactDocument = ({ artifact, medium, workspaceName }: Props) => {
  const body = dropLeadingTitleHeading({
    sourceText: artifact.sourceText,
    title: artifact.title,
  });
  const { lead, rest } = splitLead({ sourceText: body });
  const sections = documentOutline({ sourceText: rest });
  const meta = artifactMetaFields({ artifact, workspaceName });
  return (
    <article data-testid="artifact-document" data-medium={medium} className="print-document">
      <PrintLetterhead
        eyebrowLabel={meta.eyebrowLabel}
        dateLabel={meta.dateLabel}
        title={artifact.title}
      />
      {lead.length > 0 ? (
        <div className="print-body print-lead">
          <Markdown text={lead} />
        </div>
      ) : null}
      {medium === 'file' && sections.length >= CONTENTS_MIN_SECTIONS ? (
        <PrintContents sections={sections} />
      ) : null}
      <div className="print-body">
        <Markdown text={rest} />
      </div>
      <span aria-hidden className="print-footer-title">
        {artifact.title} · {workspaceName}
      </span>
    </article>
  );
};
