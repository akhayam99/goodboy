import './Statement.css';
import type { ReactNode } from 'react';
import { Eyebrow, type EyebrowKind } from './Eyebrow';

type Props = {
  readonly headingId: string;
  readonly eyebrow?: string;
  readonly eyebrowKind?: EyebrowKind;
  readonly heading: string;
  readonly lead?: ReactNode;
};

export const Statement = ({ headingId, eyebrow, eyebrowKind = 'group', heading, lead }: Props) => (
  <div className="statement">
    {eyebrow === undefined ? null : <Eyebrow text={eyebrow} kind={eyebrowKind} />}
    <h1 id={headingId} className="display">
      {heading}
    </h1>
    {lead === undefined ? null : <p className="lead">{lead}</p>}
  </div>
);
