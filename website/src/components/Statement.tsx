import './Statement.css';
import type { ReactNode } from 'react';
import { Eyebrow } from './Eyebrow';

type Props = {
  readonly headingId: string;
  readonly eyebrow?: string;
  readonly isGroup?: boolean;
  readonly heading: string;
  readonly dim?: string;
  readonly lead?: ReactNode;
  readonly level?: 1 | 2;
  readonly isCentered?: boolean;
  readonly children?: ReactNode;
};

export const Statement = ({
  headingId,
  eyebrow,
  isGroup = true,
  heading,
  dim,
  lead,
  level = 2,
  isCentered = false,
  children,
}: Props) => {
  const Heading = level === 1 ? 'h1' : 'h2';
  return (
    <div className={isCentered ? 'statement centered' : 'statement'}>
      {eyebrow === undefined ? null : <Eyebrow text={eyebrow} isGroup={isGroup} />}
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
