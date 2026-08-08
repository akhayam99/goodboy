import { DogMascot } from './DogMascot';

type Props = {
  readonly size?: number;
  readonly href?: string;
};

export const Logo = ({ size = 26, href = '#top' }: Props) => (
  <a className="logo" href={href} style={{ fontSize: size >= 26 ? 19 : 16 }}>
    <DogMascot size={size} color="var(--accent)" />
    Goodboy
  </a>
);
