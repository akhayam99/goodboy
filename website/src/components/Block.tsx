import type { ReactNode } from 'react';

type Props = {
  readonly id?: string;
  readonly headingId: string;
  readonly heading: ReactNode;
  readonly sub: ReactNode;
  readonly isAlt?: boolean;
  readonly phone?: ReactNode;
  readonly children: ReactNode;
};

export const Block = ({ id, headingId, heading, sub, isAlt = false, phone, children }: Props) => (
  <section className={isAlt ? 'block alt' : 'block'} id={id} aria-labelledby={headingId}>
    <div className="wrap">
      <div className="blockHead">
        <h2 id={headingId}>{heading}</h2>
        <p className="sub">{sub}</p>
      </div>
      {phone}
      <div className="stack">{children}</div>
    </div>
  </section>
);
