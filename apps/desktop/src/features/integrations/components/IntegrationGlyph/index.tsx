import type { LucideIcon } from 'lucide-react';
import { BrandGlyph } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';

export type IntegrationGlyphProvider =
  'bitbucket' | 'github' | 'gitlab' | 'jira' | 'linear' | 'sentry' | 'slack';

type IntegrationBrand = {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly cssVar: string;
};

const INTEGRATION_BRAND: Record<IntegrationGlyphProvider, IntegrationBrand> = {
  bitbucket: {
    icon: CONCEPT_ICONS.bitbucket,
    label: 'Bitbucket',
    cssVar: '--color-provider-bitbucket',
  },
  github: { icon: CONCEPT_ICONS.github, label: 'GitHub', cssVar: '--color-provider-github' },
  gitlab: { icon: CONCEPT_ICONS.gitlab, label: 'GitLab', cssVar: '--color-provider-gitlab' },
  jira: { icon: CONCEPT_ICONS.jira, label: 'Jira', cssVar: '--color-provider-jira' },
  linear: { icon: CONCEPT_ICONS.linear, label: 'Linear', cssVar: '--color-provider-linear' },
  sentry: { icon: CONCEPT_ICONS.sentry, label: 'Sentry', cssVar: '--color-provider-sentry' },
  slack: { icon: CONCEPT_ICONS.slack, label: 'Slack', cssVar: '--color-provider-slack' },
};

export const integrationLabel = ({ provider }: { provider: IntegrationGlyphProvider }): string =>
  INTEGRATION_BRAND[provider].label;

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
      label={brand.label}
      useBrandColor={useBrandColor}
    />
  );
};
