import { DogMascot } from './DogMascot';

type Props = {
  readonly href?: string;
};

export const Logo = ({ href = '/' }: Props) => (
  <a className="logo" href={href}>
    <span className="logoTile">
      <DogMascot size="76%" color="#fff" />
    </span>
    Goodboy
  </a>
);
