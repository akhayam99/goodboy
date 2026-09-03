import { EmptyState } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../conceptIcons';
import type { IntegrationGlyphProvider } from '../../../features/integrations/components/IntegrationGlyph';

type Props = {
  readonly provider: IntegrationGlyphProvider;
  readonly title: string;
  readonly description: string;
};

export const RecordDetailEmptyState = ({ provider, title, description }: Props) => (
  <div className="flex h-full items-center justify-center px-8">
    <EmptyState
      bordered
      tone={CONCEPT_TONE[provider]}
      icon={CONCEPT_ICONS[provider]}
      title={title}
      description={description}
      size="lg"
      headingLevel={2}
    />
  </div>
);
