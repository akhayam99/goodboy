import type { SessionArtifact } from '@goodboy/types';
import { Markdown } from '@goodboy/ui';
import { artifactMetaFields } from './artifactMetaFields';
import { CONTENTS_MIN_SECTIONS, documentOutline } from './documentOutline';
import { dropLeadingTitleHeading } from './dropLeadingTitleHeading';
import { PrintContents } from './PrintContents';
import { PrintLetterhead } from './PrintLetterhead';
import { splitLead } from './splitLead';

type Props = {
  readonly artifact: SessionArtifact;
};

export const PrintDocument = ({ artifact }: Props) => {
  const body = dropLeadingTitleHeading({
    sourceText: artifact.sourceText,
    title: artifact.title,
  });
  const { lead, rest } = splitLead({ sourceText: body });
  const sections = documentOutline({ sourceText: rest });
  return (
    <article className="print-document">
      <PrintLetterhead
        kind={artifact.kind}
        title={artifact.title}
        fields={artifactMetaFields({ artifact })}
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
