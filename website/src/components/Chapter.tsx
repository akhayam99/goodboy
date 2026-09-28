import './Chapter.css';
import type { ReactNode } from 'react';
import { Statement } from './Statement';

type Props = {
  readonly id: string;
  readonly eyebrow: string;
  readonly heading: string;
  readonly dim?: string;
  readonly lead?: ReactNode;
  readonly children: ReactNode;
};

export const Chapter = ({ id, eyebrow, heading, dim, lead, children }: Props) => (
  <section className="chapter" id={id} aria-labelledby={`${id}-title`}>
    <div className="shell">
      <div className="chapterInner">
        <Statement
          headingId={`${id}-title`}
          eyebrow={eyebrow}
          heading={heading}
          dim={dim}
          lead={lead}
        />
        <div className="chapterBody">{children}</div>
      </div>
    </div>
  </section>
);
