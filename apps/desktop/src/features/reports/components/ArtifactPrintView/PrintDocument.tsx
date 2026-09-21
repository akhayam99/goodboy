import type { SessionArtifact } from '@goodboy/types';
import { Markdown } from '@goodboy/ui';
import { artifactMetaFields } from './artifactMetaFields';
import { CONTENTS_MIN_SECTIONS, documentOutline } from './documentOutline';
import { dropLeadingTitleHeading } from './dropLeadingTitleHeading';
import { PrintContents } from './PrintContents';
import { PrintLetterhead } from './PrintLetterhead';

type Props = {
  readonly artifact: SessionArtifact;
};

export const PrintDocument = ({ artifact }: Props) => {
  const body = dropLeadingTitleHeading({
    sourceText: artifact.sourceText,
    title: artifact.title,
  });
  const sections = documentOutline({ sourceText: body });
  return (
    <article className="print-document">
      <PrintLetterhead
        kind={artifact.kind}
        title={artifact.title}
        fields={artifactMetaFields({ artifact })}
      />
      {sections.length >= CONTENTS_MIN_SECTIONS ? <PrintContents sections={sections} /> : null}
      <div className="print-body">
        <Markdown text={body} />
      </div>
    </article>
  );
};
