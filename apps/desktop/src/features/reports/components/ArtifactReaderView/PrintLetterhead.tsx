import type { ArtifactKind } from '@goodboy/types';
import mascotInk from '../../../../assets/mascot-ink.png';
import type { PrintMetaField } from './artifactMetaFields';
import { PrintMetaBlock } from './PrintMetaBlock';

type Props = {
  readonly kind: ArtifactKind;
  readonly title: string;
  readonly fields: ReadonlyArray<PrintMetaField>;
};

const MARK_SIZE = 14;

export const PrintLetterhead = ({ kind, title, fields }: Props) => (
  <header className="print-letterhead">
    <div className="print-eyebrow">
      <span className="print-kind">{kind}</span>
      <span role="img" aria-label="Goodboy" className="print-wordmark">
        <img src={mascotInk} alt="" width={MARK_SIZE} height={MARK_SIZE} className="print-mark" />
        <span aria-hidden>Goodboy</span>
      </span>
    </div>
    <h1 className="print-title">{title}</h1>
    <PrintMetaBlock fields={fields} />
    <hr className="print-rule" />
  </header>
);
