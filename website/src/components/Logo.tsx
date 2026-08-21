import { DogMascot } from './DogMascot';

type Props = {
  readonly size?: number;
  readonly href?: string;
};

const MARK_SCALE = 0.76;
const TILE_RADIUS = 0.28;

export const Logo = ({ size = 28, href = '#top' }: Props) => (
  <a className="logo" href={href} style={{ fontSize: size >= 28 ? 19 : 16 }}>
    <span
      className="logo-tile"
      style={{ width: size, height: size, borderRadius: size * TILE_RADIUS }}
    >
      <DogMascot size={size * MARK_SCALE} color="#fff" />
    </span>
    Goodboy
  </a>
);
