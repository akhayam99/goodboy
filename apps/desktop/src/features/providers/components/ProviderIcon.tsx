import { PROVIDER_IDS } from '@goodboy/types';
import { BrandGlyph } from '../../../shared/components/BrandGlyph';
import { PROVIDER_BRAND } from './provider-brand';

type Props = {
  readonly provider: string | null | undefined;
  readonly size?: number;
  readonly muted?: boolean;
  readonly variant?: 'glyph' | 'icon';
};

export const ProviderIcon = ({ provider, size = 14, muted, variant = 'icon' }: Props) => {
  const id = PROVIDER_IDS.find((candidate) => candidate === provider);
  if (id == null && variant === 'glyph') {
    return null;
  }
  if (id == null) {
    return <span className="text-2xs text-muted-foreground">{provider}</span>;
  }

  const brand = PROVIDER_BRAND[id];
  if (variant === 'glyph') {
    return (
      <BrandGlyph
        icon={brand.icon}
        cssVar={brand.cssVar}
        size={11}
        className={muted === true ? 'opacity-40' : undefined}
      />
    );
  }

  return (
    <BrandGlyph
      icon={brand.icon}
      cssVar={brand.cssVar}
      size={size}
      label={id === 'anthropic' ? 'claude' : id}
    />
  );
};
