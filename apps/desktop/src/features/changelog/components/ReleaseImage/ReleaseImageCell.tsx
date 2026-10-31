import { Button, cn } from '@goodboy/ui';

type Props = {
  readonly src: string;
  readonly alt: string;
  readonly isActive: boolean;
  readonly onOpen: () => void;
};

export const ReleaseImageCell = ({ src, alt, isActive, onOpen }: Props) => (
  <Button
    variant="ghost"
    onClick={onOpen}
    aria-hidden={isActive ? undefined : true}
    tabIndex={isActive ? undefined : -1}
    className={cn(
      'peer h-auto w-auto max-w-full cursor-zoom-in self-center justify-self-center rounded-none p-0 [grid-area:1/1] focus-visible:ring-0',
      isActive ? null : 'invisible',
    )}
  >
    <img
      src={src}
      alt={alt}
      className={cn(
        'block h-auto max-h-120 w-auto max-w-full object-contain',
        isActive ? 'animate-fade-in' : null,
      )}
    />
  </Button>
);
