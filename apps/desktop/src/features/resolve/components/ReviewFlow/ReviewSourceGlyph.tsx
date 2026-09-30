import { NotebookText } from 'lucide-react';
import type { ResolveSourceKind } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { IntegrationGlyph } from '../../../integrations/components/IntegrationGlyph';

type Props = {
  readonly kind: ResolveSourceKind;
};

export const ReviewSourceGlyph = ({ kind }: Props) =>
  kind === 'local' ? (
    <NotebookText size={ICON_SIZE.control} aria-hidden className="shrink-0 text-faint-foreground" />
  ) : (
    <IntegrationGlyph provider={kind} size={ICON_SIZE.control} />
  );
