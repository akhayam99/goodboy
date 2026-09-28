import './Fragment.css';
import type { CSSProperties, ReactNode } from 'react';
import type { FragmentFigure } from '../figures';
import { useTheme } from '../theme/theme';
import { Eyebrow } from './Eyebrow';
import { Picture } from './Picture';

type Link = {
  readonly href: string;
  readonly label: string;
};

type Props = {
  readonly id?: string;
  readonly eyebrow: string;
  readonly heading: string;
  readonly body: ReactNode;
  readonly link?: Link;
  readonly figures: readonly FragmentFigure[];
  readonly isMirrored?: boolean;
};

type WidthStyle = CSSProperties & {
  readonly '--w': string;
};

const widthStyle = (figure: FragmentFigure): WidthStyle => ({ '--w': `${figure.displayWidth}px` });

export const Fragment = ({
  id,
  eyebrow,
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
        <Eyebrow text={eyebrow} />
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
          <div className="frag" key={figure.source.id} style={widthStyle(figure)}>
            <Picture
              source={figure.source}
              theme={theme}
              sizes={`${figure.displayWidth}px`}
              alt={figure.alt}
            />
          </div>
        ))}
      </div>
    </section>
  );
};
