import './StarButton.css';
import { BrandMark } from './BrandIcons';
import { SITE } from '../site';

type Props = {
  readonly isSmall?: boolean;
};

export const StarButton = ({ isSmall = false }: Props) => (
  <a
    className={isSmall ? 'btn small onlyCoarse' : 'btn starButton onlyCoarse'}
    href={SITE.repo}
    aria-label="Star Goodboy on GitHub"
    data-star
  >
    <BrandMark brand="github" size={isSmall ? 16 : 18} />
    {isSmall ? 'Star' : 'Star on GitHub'}
  </a>
);
