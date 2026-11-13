import type { ReactNode } from 'react';
import { cn } from '../../cn';
import { LocalImage } from '../LocalImage';
import { RemoteImage } from '../RemoteImage';
import { COMMENT_IMAGE_CLASS, IMAGE_CLASS } from '../RemoteImage/imageClass';

type ImageParams = {
  readonly alt: string;
  readonly url: string;
  readonly key: string;
  readonly variant: 'document' | 'preview';
};

export const renderImage = ({ alt, url, key, variant }: ImageParams): ReactNode => {
  const capClass = variant === 'preview' ? COMMENT_IMAGE_CLASS : undefined;
  if (/^data:image[/]svg/i.test(url)) {
    return alt;
  }
  if (/^data:image[/]/i.test(url)) {
    return <img key={key} src={url} alt={alt} className={cn(IMAGE_CLASS, capClass)} />;
  }
  if (/^data:/i.test(url)) {
    return alt;
  }
  if (variant === 'preview' && !/^https:/i.test(url)) {
    return alt;
  }
  if (!/^https?:/i.test(url)) {
    if (
      url.length <= 1024 &&
      !/\s/.test(url) &&
      !/^(?:[a-z][a-z\d+.-]*:|[/][/])/i.test(url) &&
      /\.(?:png|jpe?g|gif|webp)$/i.test(url)
    ) {
      return <LocalImage key={`${key}-${url}`} url={url} alt={alt} />;
    }
    return alt;
  }
  return <RemoteImage key={key} url={url} alt={alt} className={capClass} />;
};
