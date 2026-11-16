import { BrandGlyph, ICON_SIZE } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import type { ConnectionToolId } from '../../model/connectionState';

type Props = {
  readonly tool: ConnectionToolId;
};

export const ToolGlyph = ({ tool }: Props) => (
  <BrandGlyph
    icon={CONCEPT_ICONS[tool]}
    cssVar={`--color-provider-${tool}`}
    size={ICON_SIZE.control}
  />
);
