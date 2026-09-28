import type { Theme } from '../theme/theme';

export type Source = {
  readonly id: string;
  readonly widths: readonly number[];
  readonly width: number;
  readonly height: number;
};

type Props = {
  readonly source: Source;
  readonly phone?: Source;
  readonly theme: Theme;
  readonly sizes: string;
  readonly phoneSizes?: string;
  readonly alt: string;
  readonly isEager?: boolean;
  readonly className?: string;
};

export const PHONE_QUERY = '(max-width: 600px)';

type SrcSetParams = {
  readonly source: Source;
  readonly theme: Theme;
};

type FileParams = SrcSetParams & {
  readonly width: number;
};

const fileOf = ({ source, theme, width }: FileParams) =>
  `/img/${source.id}-${width}${theme === 'light' ? '-light' : ''}.webp`;

const srcSet = ({ source, theme }: SrcSetParams) =>
  source.widths.map((width) => `${fileOf({ source, theme, width })} ${width}w`).join(', ');

const fallback = ({ source, theme }: SrcSetParams) =>
  fileOf({ source, theme, width: source.widths[source.widths.length - 1] });

export const Picture = ({
  source,
  phone,
  theme,
  sizes,
  phoneSizes,
  alt,
  isEager = false,
  className,
}: Props) => (
  <picture>
    {phone === undefined ? null : (
      <source
        media={PHONE_QUERY}
        srcSet={srcSet({ source: phone, theme })}
        sizes={phoneSizes ?? sizes}
        width={phone.width}
        height={phone.height}
      />
    )}
    <img
      className={className}
      src={fallback({ source, theme })}
      srcSet={srcSet({ source, theme })}
      sizes={sizes}
      width={source.width}
      height={source.height}
      alt={alt}
      loading={isEager ? 'eager' : 'lazy'}
      fetchPriority={isEager ? 'high' : 'auto'}
      decoding="async"
    />
  </picture>
);
