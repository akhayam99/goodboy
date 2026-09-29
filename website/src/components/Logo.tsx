import { DogMascot } from './DogMascot';

type Props = {
  readonly href?: string;
};

const MARK_SCALE = 0.76;
const TILE_RADIUS = 0.28;

export const Logo = ({ href = '/' }: Props) => (
  <a className="logo" href={href}>
    <span className="logoTile" style={{ borderRadius: `${TILE_RADIUS * 100}%` }}>
      <DogMascot size={`${MARK_SCALE * 100}%`} color="#fff" />
    </span>
    Goodboy
  </a>
);
