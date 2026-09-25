import { Plug } from 'lucide-react';
import { cn, tintClasses } from '@goodboy/ui';
import { openProviderUsage } from '../../../../features/providers/openProviderUsage';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

export const ConnectProviderChip = () => (
  <button
    type="button"
    onClick={() => openProviderUsage({ providerId: null })}
    className={cn(
      'flex h-6 shrink-0 items-center gap-1.5 rounded-sm px-1.5 text-2xs font-medium motion-safe:transition-colors hover:bg-hover',
      tintClasses('warning').text,
    )}
  >
    <Plug size={ICON_SIZE.row} aria-hidden />
    <span>Connect a provider</span>
  </button>
);
