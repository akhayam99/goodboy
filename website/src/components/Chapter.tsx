import './Chapter.css';
import type { ReactNode } from 'react';
import type { EyebrowKind } from './Eyebrow';
import { Statement } from './Statement';

type Head = {
  readonly eyebrow?: string;
  readonly eyebrowKind?: EyebrowKind;
  readonly heading: string;
  readonly lead?: ReactNode;
};

export type Tone = 'page' | 'band' | 'stage';

type Props = {
  readonly id: string;
  readonly label?: string;
  readonly head?: Head;
  readonly tone?: Tone;
  readonly children: ReactNode;
};

export const Chapter = ({ id, label, head, tone = 'page', children }: Props) => (
  <section
    className={`chapter tone-${tone}`}
    data-tone={tone}
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
