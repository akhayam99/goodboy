import type { ReactNode } from 'react';
import { EmptyState, type EmptyStateProps } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { integrationLabel, type IntegrationGlyphProvider } from '../IntegrationGlyph';

type Props = {
  readonly provider: IntegrationGlyphProvider;
  readonly description: string;
  readonly children: ReactNode;
  readonly size?: EmptyStateProps['size'];
  readonly headingLevel?: EmptyStateProps['headingLevel'];
};

export const IntegrationConnectPanel = ({
  provider,
  description,
  children,
  size,
  headingLevel,
}: Props) => (
  <EmptyState
    bordered
    icon={CONCEPT_ICONS[provider]}
    title={integrationLabel({ provider })}
    description={description}
    size={size}
    headingLevel={headingLevel}
    className="w-full max-w-md border-solid bg-background shadow-sm"
    action={<div className="w-full">{children}</div>}
  />
);
