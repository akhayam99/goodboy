import type { LucideIcon } from 'lucide-react';
import { BrandGlyph } from '../../../../shared/components/BrandGlyph';
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

type Props = {
  readonly provider: IntegrationGlyphProvider;
  readonly size?: number | 'xs' | 'sm';
  readonly className?: string;
};

export const IntegrationGlyph = ({ provider, size = 'sm', className }: Props) => {
  const brand = INTEGRATION_BRAND[provider];
  return (
    <BrandGlyph
      icon={brand.icon}
      cssVar={brand.cssVar}
      size={size}
      className={className}
      label={brand.label}
    />
  );
};
