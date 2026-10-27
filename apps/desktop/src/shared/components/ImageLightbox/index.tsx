import { useEffect } from 'react';
import { X } from 'lucide-react';
import { Dialog, ICON_SIZE, IconButton } from '@goodboy/ui';

type Props = {
  readonly src: string;
  readonly alt: string;
  readonly onClose: () => void;
  readonly media?: 'image' | 'pdf';
};

export const ImageLightbox = ({ src, alt, onClose, media = 'image' }: Props) => {
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  return (
    <Dialog
      open
      onClose={onClose}
      title={alt}
      size="full"
      surface="screen"
      showClose={false}
      headerBordered={false}
      bodyClassName="relative min-h-full items-center justify-center p-8"
    >
      <div
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
        className="relative flex min-h-0 flex-1 items-center justify-center"
      >
        <IconButton
          icon={X}
          label="Close image preview"
          tooltip="Close image preview"
          shortcut="overlay.close"
          iconSize={ICON_SIZE.hero}
          onClick={onClose}
          className="absolute right-0 top-0 h-9 w-9 rounded-full bg-background p-0 text-foreground shadow-lg ring-1 ring-border-soft hover:bg-background hover:text-foreground"
        />
        {media === 'pdf' ? (
          <iframe
            src={src}
            title={alt}
            sandbox=""
            className="h-full w-full max-w-3xl rounded-lg bg-white shadow-xl"
          />
        ) : (
          <img
            src={src}
            alt={alt}
            className="max-h-full max-w-full rounded-lg object-contain shadow-xl"
          />
        )}
      </div>
    </Dialog>
  );
};
