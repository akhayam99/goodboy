import { cn } from '@goodboy/ui';

type Props = {
  readonly image: string;
  readonly className?: string;
};

export const MaskedDog = ({ image, className }: Props) => {
  return (
    <span
      aria-hidden
      className={cn('shrink-0', className)}
      style={{
        maskImage: `url(${image})`,
        maskRepeat: 'no-repeat',
        maskPosition: 'center',
        maskSize: 'contain',
        WebkitMaskImage: `url(${image})`,
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        WebkitMaskSize: 'contain',
      }}
    />
  );
};
