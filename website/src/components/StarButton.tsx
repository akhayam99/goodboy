import './StarButton.css';
import { BrandMark } from './BrandIcons';
import { StarCount } from './StarCount';
import { SITE } from '../lib/site';
import { trackAttributes } from '../lib/trackAttributes';

type Props = {
  readonly location: 'hero' | 'install' | 'features' | 'nav_sheet';
  readonly isSmall?: boolean;
};

export const StarButton = ({ location, isSmall = false }: Props) => (
  <a
    className={isSmall ? 'btn small onlyCoarse' : 'btn starButton onlyCoarse'}
    href={SITE.repo}
    data-star
    {...trackAttributes({ event: 'star_click', params: { cta_location: location } })}
  >
    <BrandMark brand="github" size={isSmall ? 16 : 18} />
    {isSmall ? 'Star' : 'Star on GitHub'}
    <StarCount />
  </a>
);
