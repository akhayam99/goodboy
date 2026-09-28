import './Beat.css';
import type { ReactNode } from 'react';
import { Stage } from '../components/Stage';
import { revealStyle } from '../components/revealStyle';
import { SITE } from '../site';

export type BeatLink = {
  readonly label: string;
  readonly anchor: string;
};

type Props = {
  readonly id: string;
  readonly isBand?: boolean;
  readonly leadIn?: string;
  readonly heading: ReactNode;
  readonly body: string;
  readonly links: readonly BeatLink[];
  readonly fine?: string;
  readonly children: ReactNode;
};

export const Beat = ({
  id,
  isBand = false,
  leadIn,
  heading,
  body,
  links,
  fine,
  children,
}: Props) => {
  const offset = leadIn === undefined ? 0 : 1;

  return (
    <section className={isBand ? 'beat band' : 'beat'} id={id} aria-labelledby={`${id}-title`}>
      <div className="shell">
        <div className="beatInner">
          <div className="beatHead">
            <div className="beatTitle">
              {leadIn === undefined ? null : (
                <p className="leadIn" data-reveal style={revealStyle({ index: 0 })}>
                  {leadIn}
                </p>
              )}
              <h2
                id={`${id}-title`}
                className="beatHeading"
                data-reveal
                style={revealStyle({ index: offset })}
              >
                {heading}
              </h2>
            </div>
            <div className="beatText">
              <p className="beatBody" data-reveal style={revealStyle({ index: offset + 1 })}>
                {body}
              </p>
              <div className="beatLinks" data-reveal style={revealStyle({ index: offset + 2 })}>
                {links.map((link) => (
                  <a
                    key={link.anchor}
                    className="textLink"
                    href={`${SITE.featureGuide}#${link.anchor}`}
                  >
                    {link.label} <span aria-hidden="true">→</span>
                  </a>
                ))}
              </div>
              {fine === undefined ? null : (
                <p className="beatFine" data-reveal style={revealStyle({ index: offset + 3 })}>
                  {fine}
                </p>
              )}
            </div>
          </div>
          <Stage>{children}</Stage>
        </div>
      </div>
    </section>
  );
};
