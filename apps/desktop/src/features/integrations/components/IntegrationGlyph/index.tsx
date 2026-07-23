import { cn } from '@goodboy/ui';

export type IntegrationGlyphProvider = 'github' | 'gitlab' | 'linear' | 'sentry';

const GLYPH: Record<IntegrationGlyphProvider, string> = {
  github: 'GH',
  gitlab: 'G',
  linear: 'L',
  sentry: 'S',
};

const BADGE_STYLE: Record<IntegrationGlyphProvider, string> = {
  github: 'bg-provider-github',
  gitlab: 'bg-provider-gitlab',
  linear: 'bg-provider-linear',
  sentry: 'bg-provider-sentry',
};

const FRAME_STYLE: Record<IntegrationGlyphProvider, string> = {
  github: 'bg-provider-github/10',
  gitlab: 'bg-provider-gitlab/10',
  linear: 'bg-provider-linear/10',
  sentry: 'bg-provider-sentry/10',
};

const SIZE: Record<'xs' | 'sm', string> = {
  xs: 'size-3 text-[7px]',
  sm: 'size-4 text-[9px]',
};

type Props = {
  readonly provider: IntegrationGlyphProvider;
  readonly size?: 'xs' | 'sm';
  readonly framed?: boolean;
  readonly className?: string;
};

export const IntegrationGlyph = ({ provider, size = 'sm', framed = false, className }: Props) => {
  const badge = (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-sm font-bold text-white',
        SIZE[size],
        BADGE_STYLE[provider],
        !framed && className,
      )}
    >
      {GLYPH[provider]}
    </span>
  );

  if (!framed) {
    return badge;
  }

  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-lg',
        FRAME_STYLE[provider],
        className,
      )}
    >
      {badge}
    </span>
  );
};
