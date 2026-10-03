import { SlidersHorizontal } from 'lucide-react';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { providerGlyph } from '../../../providers/providerGlyph';
import type { SettingsPageGlyph } from './settingsDirectory';

type Props = {
  readonly glyph: SettingsPageGlyph;
  readonly size: number;
};

export const SettingsPageIcon = ({ glyph, size }: Props) => {
  switch (glyph.kind) {
    case 'concept': {
      const Icon = CONCEPT_ICONS[glyph.concept];
      return <Icon size={size} aria-hidden />;
    }
    case 'defaults':
      return <SlidersHorizontal size={size} aria-hidden />;
    case 'provider': {
      const { icon: Icon, color } = providerGlyph({ provider: glyph.provider });
      return <Icon size={size} aria-hidden style={{ color }} />;
    }
    default: {
      const unreachable: never = glyph;
      return unreachable;
    }
  }
};
