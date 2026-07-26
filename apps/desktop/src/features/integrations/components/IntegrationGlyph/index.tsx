import { cn, IconTile } from '@goodboy/ui';
import type { LucideIcon } from 'lucide-react';
import {
  GithubIcon,
  GitlabIcon,
  LinearIcon,
  SentryIcon,
} from '../../../../shared/components/brand-icons';

export type IntegrationGlyphProvider = 'github' | 'gitlab' | 'linear' | 'sentry';

type IntegrationBrand = {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly cssVar: string;
};

const INTEGRATION_BRAND: Record<IntegrationGlyphProvider, IntegrationBrand> = {
  github: { icon: GithubIcon, label: 'GitHub', cssVar: '--color-provider-github' },
  gitlab: { icon: GitlabIcon, label: 'GitLab', cssVar: '--color-provider-gitlab' },
  linear: { icon: LinearIcon, label: 'Linear', cssVar: '--color-provider-linear' },
  sentry: { icon: SentryIcon, label: 'Sentry', cssVar: '--color-provider-sentry' },
};

const MARK_SIZE: Record<'xs' | 'sm', number> = {
  xs: 12,
  sm: 14,
};

const FRAMED_MARK_SIZE = 16;

type Props = {
  readonly provider: IntegrationGlyphProvider;
  readonly size?: 'xs' | 'sm';
  readonly framed?: boolean;
  readonly className?: string;
};

export const IntegrationGlyph = ({ provider, size = 'sm', framed = false, className }: Props) => {
  const { icon: Icon, label, cssVar } = INTEGRATION_BRAND[provider];
  const color = `var(${cssVar})`;

  if (!framed) {
    return (
      <Icon
        size={MARK_SIZE[size]}
        role="img"
        aria-label={label}
        className={cn('shrink-0', className)}
        style={{ color }}
      />
    );
  }

  return (
    <IconTile size="sm" color={color} className={className}>
      <Icon size={FRAMED_MARK_SIZE} role="img" aria-label={label} style={{ color }} />
    </IconTile>
  );
};
