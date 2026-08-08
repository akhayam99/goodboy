import type { CSSProperties } from 'react';
import mascot from '../assets/mascot.png';

type Props = {
  readonly size?: number;
  readonly color?: string;
};

export const DogMascot = ({ size = 16, color = 'currentColor' }: Props) => {
  const style: CSSProperties = {
    display: 'inline-block',
    flexShrink: 0,
    width: size,
    height: size,
    backgroundColor: color,
    maskImage: `url(${mascot})`,
    maskRepeat: 'no-repeat',
    maskPosition: 'center',
    maskSize: 'contain',
    WebkitMaskImage: `url(${mascot})`,
    WebkitMaskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    WebkitMaskSize: 'contain',
  };

  return <span aria-hidden style={style} />;
};
