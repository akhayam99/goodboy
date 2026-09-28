import './Fragment.css';
import type { CSSProperties, ReactNode } from 'react';
import type { FragmentFigure } from '../figures';
import { useTheme } from '../theme/theme';
import { Eyebrow, type EyebrowKind } from './Eyebrow';
import { Picture } from './Picture';

type Link = {
  readonly href: string;
  readonly label: string;
};

type Props = {
  readonly id?: string;
  readonly eyebrow: string;
  readonly eyebrowKind?: EyebrowKind;
  readonly heading: string;
  readonly body: ReactNode;
  readonly link?: Link;
  readonly figures: readonly FragmentFigure[];
  readonly isMirrored?: boolean;
};

type WidthStyle = CSSProperties & {
  readonly '--w': string;
  readonly '--cap'?: string;
};

const widthStyle = (figure: FragmentFigure): WidthStyle => ({
  '--w': `${figure.displayWidth}px`,
  '--cap': figure.cap === undefined ? undefined : `${figure.cap}px`,
});

export const Fragment = ({
  id,
  eyebrow,
  eyebrowKind = 'group',
  heading,
  body,
  link,
  figures,
  isMirrored = false,
}: Props) => {
  const theme = useTheme();
  const headingId = `${id ?? figures[0].source.id}-title`;

  return (
    <section
      className={isMirrored ? 'split mirrored' : 'split'}
      id={id}
      aria-labelledby={headingId}
    >
      <div className="splitText">
        <Eyebrow text={eyebrow} kind={eyebrowKind} />
        <h3 id={headingId} className="sectionTitle">
          {heading}
        </h3>
        <p className="body">{body}</p>
        {link === undefined ? null : (
          <a className="textLink" href={link.href}>
            {link.label} <span aria-hidden="true">→</span>
          </a>
        )}
      </div>
      <div className="splitMedia">
        {figures.map((figure) => (
          <div
            className={[
              'frag',
              figure.cap === undefined ? null : 'capped',
              figure.isClosed === true ? 'closed' : null,
            ]
              .filter(Boolean)
              .join(' ')}
            key={figure.source.id}
            style={widthStyle(figure)}
            data-reveal=""
          >
            <div className="fragView">
              <Picture
                source={figure.source}
                theme={theme}
                sizes={`${figure.displayWidth}px`}
                alt={figure.alt}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
