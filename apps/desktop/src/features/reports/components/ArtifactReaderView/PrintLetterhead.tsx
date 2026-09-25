import type { ArtifactKind } from '@goodboy/types';
import mascotInk from '../../../../assets/mascot-ink.png';
import type { PrintMetaField } from './artifactMetaFields';
import { PrintMetaBlock } from './PrintMetaBlock';

type Props = {
  readonly kind: ArtifactKind;
  readonly title: string;
  readonly fields: ReadonlyArray<PrintMetaField>;
  readonly hasMark?: boolean;
};

const MARK_SIZE = 14;

export const PrintLetterhead = ({ kind, title, fields, hasMark = true }: Props) => (
  <header className="print-letterhead">
    <div className="print-eyebrow">
      <span className="print-kind">{kind}</span>
      <span role="img" aria-label="Goodboy" className="print-wordmark">
        {hasMark ? (
          <img src={mascotInk} alt="" width={MARK_SIZE} height={MARK_SIZE} className="print-mark" />
        ) : null}
        <span aria-hidden>Goodboy</span>
      </span>
    </div>
    <h1 className="print-title">{title}</h1>
    <PrintMetaBlock fields={fields} />
    <hr className="print-rule" />
  </header>
);
