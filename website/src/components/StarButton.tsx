import './StarButton.css';
import { BrandMark } from './BrandIcons';
import { StarCount } from './StarCount';
import { SITE } from '../site';

type Props = {
  readonly isSmall?: boolean;
};

export const StarButton = ({ isSmall = false }: Props) => (
  <a
    className={isSmall ? 'btn small onlyCoarse' : 'btn starButton onlyCoarse'}
    href={SITE.repo}
    data-star
  >
    <BrandMark brand="github" size={isSmall ? 16 : 18} />
    {isSmall ? 'Star' : 'Star on GitHub'}
    <StarCount />
  </a>
);
