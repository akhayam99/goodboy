import type { CSSProperties } from 'react';
import { cn } from '@goodboy/ui';
import mascot from '../../../assets/mascot.png';

interface Props {
  size?: number;
  className?: string;
}

export function DogMascot({ size = 16, className }: Props) {
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

  return <span aria-hidden style={style} className={cn('inline-block shrink-0', className)} />;
}
