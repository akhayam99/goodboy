import './Statement.css';
import type { ReactNode } from 'react';
import { Eyebrow, type EyebrowKind } from './Eyebrow';

type Props = {
  readonly headingId: string;
  readonly eyebrow?: string;
  readonly eyebrowKind?: EyebrowKind;
  readonly heading: string;
  readonly dim?: string;
  readonly lead?: ReactNode;
  readonly level?: 1 | 2;
  readonly isCentered?: boolean;
  readonly className?: string;
  readonly children?: ReactNode;
};

export const Statement = ({
  headingId,
  eyebrow,
  eyebrowKind = 'group',
  heading,
  dim,
  lead,
  level = 2,
  isCentered = false,
  className,
  children,
}: Props) => {
  const Heading = level === 1 ? 'h1' : 'h2';
  return (
    <div
      className={['statement', isCentered ? 'centered' : null, className].filter(Boolean).join(' ')}
    >
      {eyebrow === undefined ? null : <Eyebrow text={eyebrow} kind={eyebrowKind} />}
      <Heading id={headingId} className={level === 1 ? 'display' : 'chapterTitle'}>
        {heading}
        {dim === undefined ? null : (
          <>
            {' '}
            <span className="dim">{dim}</span>
          </>
        )}
      </Heading>
      {lead === undefined ? null : <p className="lead">{lead}</p>}
      {children}
    </div>
  );
};
