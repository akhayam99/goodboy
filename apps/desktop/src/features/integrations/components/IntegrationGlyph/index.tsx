import type { LucideIcon } from 'lucide-react';
import { BrandGlyph } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { integrationLabel } from '../../../../shared/utils/integrationLabel';

export type IntegrationGlyphProvider =
  'bitbucket' | 'github' | 'gitlab' | 'jira' | 'linear' | 'sentry' | 'slack';

type IntegrationBrand = {
  readonly icon: LucideIcon;
  readonly cssVar: string;
};

const INTEGRATION_BRAND: Record<IntegrationGlyphProvider, IntegrationBrand> = {
  bitbucket: {
    icon: CONCEPT_ICONS.bitbucket,
    cssVar: '--color-provider-bitbucket',
  },
  github: { icon: CONCEPT_ICONS.github, cssVar: '--color-provider-github' },
  gitlab: { icon: CONCEPT_ICONS.gitlab, cssVar: '--color-provider-gitlab' },
  jira: { icon: CONCEPT_ICONS.jira, cssVar: '--color-provider-jira' },
  linear: { icon: CONCEPT_ICONS.linear, cssVar: '--color-provider-linear' },
  sentry: { icon: CONCEPT_ICONS.sentry, cssVar: '--color-provider-sentry' },
  slack: { icon: CONCEPT_ICONS.slack, cssVar: '--color-provider-slack' },
};

type Props = {
  readonly provider: IntegrationGlyphProvider;
  readonly size?: number | 'xs' | 'sm';
  readonly className?: string;
  readonly useBrandColor?: boolean;
};

export const IntegrationGlyph = ({
  provider,
  size = 'sm',
  className,
  useBrandColor = true,
}: Props) => {
  const brand = INTEGRATION_BRAND[provider];
  return (
    <BrandGlyph
      icon={brand.icon}
      cssVar={brand.cssVar}
      size={size}
      className={className}
      label={integrationLabel({ provider })}
      useBrandColor={useBrandColor}
    />
  );
};
