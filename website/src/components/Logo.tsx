import { DogMascot } from './DogMascot';

type Props = {
  readonly href?: string;
};

const TILE_PX = 28;
const MARK_SCALE = 0.76;
const TILE_RADIUS = 0.28;

export const Logo = ({ href = '/' }: Props) => (
  <a className="logo" href={href}>
    <span
      className="logoTile"
      style={{ width: TILE_PX, height: TILE_PX, borderRadius: TILE_PX * TILE_RADIUS }}
    >
      <DogMascot size={TILE_PX * MARK_SCALE} color="#fff" />
    </span>
    Goodboy
  </a>
);
