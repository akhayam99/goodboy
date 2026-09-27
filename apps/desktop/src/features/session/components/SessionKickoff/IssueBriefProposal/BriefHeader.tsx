import type { ReactNode } from 'react';
import { Eyebrow } from '@goodboy/ui';
import { IntegrationGlyph } from '../../../../integrations/components/IntegrationGlyph';
import type { IssueBriefSource } from '../../../../../store/slices/issue-briefs/types';

type Props = {
  readonly source: IssueBriefSource;
  readonly label: string;
  readonly trailing: ReactNode;
};

export const BriefHeader = ({ source, label, trailing }: Props) => (
  <header className="flex min-h-6 items-center gap-2">
    <IntegrationGlyph provider={source.provider} size="xs" />
    <Eyebrow label={label} className="min-w-0 flex-1 truncate" />
    {trailing}
  </header>
);
