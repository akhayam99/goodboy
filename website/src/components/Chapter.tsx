import './Chapter.css';
import type { ReactNode } from 'react';
import type { EyebrowKind } from './Eyebrow';
import { Statement } from './Statement';

type Head = {
  readonly eyebrow: string;
  readonly eyebrowKind?: EyebrowKind;
  readonly heading: string;
  readonly lead?: ReactNode;
};

type Props = {
  readonly id: string;
  readonly label?: string;
  readonly head?: Head;
  readonly isBand?: boolean;
  readonly children: ReactNode;
};

export const Chapter = ({ id, label, head, isBand = false, children }: Props) => (
  <section
    className={isBand ? 'chapter band' : 'chapter'}
    id={id}
    aria-label={head === undefined ? label : undefined}
    aria-labelledby={head === undefined ? undefined : `${id}-title`}
  >
    <div className="shell">
      <div className="chapterInner">
        {head === undefined ? null : <Statement headingId={`${id}-title`} {...head} />}
        <div className="chapterBody">{children}</div>
      </div>
    </div>
  </section>
);
