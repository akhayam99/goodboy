import { cn, IconTile } from '@goodboy/ui';
import type { ProviderId } from '@goodboy/types';
import { PROVIDER_BRAND, brandColor } from './provider-brand';

type Props = {
  readonly provider: string | null | undefined;
  readonly size?: number;
  readonly withChip?: boolean;
  readonly muted?: boolean;
  readonly variant?: 'glyph' | 'icon';
};

const PROVIDER_IDS: ReadonlyArray<ProviderId> = ['anthropic', 'cursor', 'codex', 'gemini'];

export const ProviderIcon = ({
  provider,
  size = 14,
  withChip = false,
  muted,
  variant = 'icon',
}: Props) => {
  if (variant === 'glyph') {
    if (provider == null || provider === '' || !(provider in PROVIDER_BRAND)) {
      return null;
    }
    const id = provider as ProviderId;
    const Icon = PROVIDER_BRAND[id].icon;
    return (
      <Icon
        size={11}
        aria-hidden
        className={cn('shrink-0', muted && 'opacity-40')}
        style={{ color: brandColor(id) }}
      />
    );
  }

  const id = PROVIDER_IDS.includes(provider as ProviderId) ? (provider as ProviderId) : null;
  if (id === null) {
    return <span className="text-2xs text-muted-foreground">{provider}</span>;
  }
  const Icon = PROVIDER_BRAND[id].icon;
  const color = brandColor(id);
  const label = id === 'anthropic' ? 'claude' : id;

  if (!withChip) {
    return <Icon size={size} aria-label={label} style={{ color }} />;
  }

  let tileSize: 'xs' | 'sm' | 'md' | 'lg' = 'md';
  if (size <= 16) {
    tileSize = 'xs';
  }
  if (size > 16 && size <= 22) {
    tileSize = 'sm';
  }
  if (size > 30) {
    tileSize = 'lg';
  }

  return (
    <IconTile size={tileSize} color={color}>
      <Icon size={size} aria-label={label} />
    </IconTile>
  );
};
