import { DogMascot } from './DogMascot';

type Props = {
  readonly href?: string;
};

const TILE_PX = 28;
const MARK_PX = 21;

export const Logo = ({ href = '/' }: Props) => (
  <a className="logo" href={href}>
    <span className="logoTile" style={{ width: TILE_PX, height: TILE_PX }}>
      <DogMascot size={MARK_PX} color="#fff" />
    </span>
    Goodboy
  </a>
);
