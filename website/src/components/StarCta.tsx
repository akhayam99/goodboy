import './StarCta.css';
import type { ReactNode } from 'react';
import { BrandMark } from './BrandIcons';
import { SITE } from '../site';

type Props = {
  readonly note?: ReactNode;
};

export const StarCta = ({ note }: Props) => (
  <div className="starCta onlyCoarse">
    <a className="btn" href={SITE.repo} data-star>
      <BrandMark brand="github" size={18} />
      Star on GitHub
    </a>
    {note === undefined ? null : <p className="starNote">{note}</p>}
    <a className="btn ghost" href={SITE.featureGuide}>
      See every feature
    </a>
  </div>
);
