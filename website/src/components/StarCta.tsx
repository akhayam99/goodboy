import './StarCta.css';
import type { ReactNode } from 'react';
import { BrandMark } from './BrandIcons';
import { SITE } from '../site';

type Props = {
  readonly note?: ReactNode;
  readonly hasFeatureLink?: boolean;
};

export const StarCta = ({ note, hasFeatureLink = true }: Props) => (
  <div className="starCta onlyCoarse">
    <a className="btn" href={SITE.repo} data-star>
      <BrandMark brand="github" size={18} />
      Star on GitHub
    </a>
    {note === undefined ? null : <p className="starNote">{note}</p>}
    {hasFeatureLink ? (
      <a className="btn ghost" href={SITE.featureGuide}>
        See every feature
      </a>
    ) : null}
  </div>
);
