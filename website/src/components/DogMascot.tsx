import type { CSSProperties } from 'react';
import mascot from '../assets/mascot.png';

interface DogMascotProps {
  size?: number;
  className?: string;
}

export function DogMascot({ size = 16, className }: DogMascotProps) {
  const style: CSSProperties = {
    width: size,
    height: size,
    backgroundColor: 'currentColor',
    maskImage: `url(${mascot})`,
    maskRepeat: 'no-repeat',
    maskPosition: 'center',
    maskSize: 'contain',
    WebkitMaskImage: `url(${mascot})`,
    WebkitMaskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    WebkitMaskSize: 'contain',
  };

  return <span aria-hidden style={style} className={`inline-block shrink-0 ${className ?? ''}`} />;
}
