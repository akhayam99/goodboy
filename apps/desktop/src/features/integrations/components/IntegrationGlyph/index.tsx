import type { LucideIcon } from 'lucide-react';
import { BrandGlyph } from '../../../../shared/components/BrandGlyph';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';

export type IntegrationGlyphProvider = 'github' | 'gitlab' | 'linear' | 'sentry';

type IntegrationBrand = {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly cssVar: string;
};

const INTEGRATION_BRAND: Record<IntegrationGlyphProvider, IntegrationBrand> = {
  github: { icon: CONCEPT_ICONS.github, label: 'GitHub', cssVar: '--color-provider-github' },
  gitlab: { icon: CONCEPT_ICONS.gitlab, label: 'GitLab', cssVar: '--color-provider-gitlab' },
  linear: { icon: CONCEPT_ICONS.linear, label: 'Linear', cssVar: '--color-provider-linear' },
  sentry: { icon: CONCEPT_ICONS.sentry, label: 'Sentry', cssVar: '--color-provider-sentry' },
};

export const integrationLabel = ({ provider }: { provider: IntegrationGlyphProvider }): string =>
  INTEGRATION_BRAND[provider].label;

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
