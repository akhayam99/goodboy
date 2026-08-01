import type { ReactNode } from 'react';
import { EmptyState } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { integrationLabel, type IntegrationGlyphProvider } from '../IntegrationGlyph';

type Props = {
  readonly provider: IntegrationGlyphProvider;
  readonly description: string;
  readonly children: ReactNode;
};

export const IntegrationConnectPanel = ({ provider, description, children }: Props) => (
  <EmptyState
    bordered
    icon={CONCEPT_ICONS[provider]}
    title={`Connect ${integrationLabel({ provider })}`}
    description={description}
    className="w-full max-w-md bg-background p-5 shadow-sm"
    action={children}
  />
);
